import {
  createParamDecorator,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext
} from "@nestjs/common";
import {
  DASHBOARD_CAPABILITIES,
  hasClerkManagedBillingCapability,
  roleHasDashboardCapability,
  type DashboardAuthStore,
  type DashboardCapability,
  type DashboardMembership,
  type DashboardRole
} from "../review-runs/dashboard-auth.store";
import {
  FULL_REPOSITORY_ACCESS_SCOPE,
  resolveRepositoryAccessScope,
  type RepositoryAccessScope
} from "./repository-access-scope";

export interface DashboardRequestContext {
  readonly clerkUserId: string;
  readonly clerkOrgId: string | null;
  readonly sessionId: string | null;
  readonly workspaceId: string;
  readonly role: DashboardRole;
  readonly capabilities: readonly DashboardCapability[];
  readonly clerkCapabilities: readonly string[];
}

export interface DashboardAuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  dashboardAuth?: DashboardRequestContext;
}

export const DashboardAuth = createParamDecorator((_data: unknown, context: ExecutionContext): DashboardRequestContext => {
  const request = context.switchToHttp().getRequest<DashboardAuthenticatedRequest>();

  if (request.dashboardAuth === undefined) {
    throw new Error("Dashboard auth context is not available");
  }

  return request.dashboardAuth;
});

export type DashboardAuthParam = DashboardRequestContext | string | string[] | undefined;

export function isDashboardRequestContext(value: DashboardAuthParam): value is DashboardRequestContext {
  return (
    value !== undefined &&
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "workspaceId" in value &&
    "clerkUserId" in value &&
    "role" in value
  );
}

export function requireDashboardRequestContext(value: DashboardAuthParam): DashboardRequestContext {
  if (!isDashboardRequestContext(value)) {
    throw new UnauthorizedException("Dashboard authentication is required");
  }

  return value;
}

export function toDashboardServiceAuth(auth: DashboardAuthParam): {
  readonly workspaceId: string;
  readonly clerkUserId: string;
};
export function toDashboardServiceAuth(auth: DashboardAuthParam, legacyUserIdHeader: string | string[] | undefined): {
  readonly workspaceId: string | null;
  readonly clerkUserId: string | null;
};
export function toDashboardServiceAuth(auth: DashboardAuthParam, legacyUserIdHeader?: string | string[] | undefined): {
  readonly workspaceId: string | null;
  readonly clerkUserId: string | null;
} {
  if (!isDashboardRequestContext(auth)) {
    return readTestOnlyLegacyServiceAuth(auth, legacyUserIdHeader);
  }

  return {
    workspaceId: auth.workspaceId,
    clerkUserId: auth.clerkUserId
  };
}

export function resolveRepositoryAccessScopeFromAuth(auth: DashboardAuthParam): RepositoryAccessScope {
  if (!isDashboardRequestContext(auth)) {
    return FULL_REPOSITORY_ACCESS_SCOPE;
  }

  return resolveRepositoryAccessScope({ role: auth.role, clerkUserId: auth.clerkUserId });
}

export function resolveRepositoryAccessScopeFromMembership(membership: DashboardMembership): RepositoryAccessScope {
  return resolveRepositoryAccessScope({ role: membership.role, clerkUserId: membership.clerkUserId });
}

export function hasDashboardCapability(context: DashboardRequestContext, capability: DashboardCapability): boolean {
  return roleHasDashboardCapability(context.role, capability, {
    hasClerkBillingCapability: context.capabilities.includes("manage_billing")
  });
}

export function requireDashboardCapability(
  context: DashboardRequestContext,
  capability: DashboardCapability,
  message: string
): void {
  if (!hasDashboardCapability(context, capability)) {
    throw new ForbiddenException(message);
  }
}

export function deriveDashboardCapabilities(
  role: DashboardRole,
  clerkCapabilities: readonly string[]
): readonly DashboardCapability[] {
  const capabilities: DashboardCapability[] = [];
  const hasClerkBillingCapability = clerkCapabilities.some((capability) =>
    hasClerkManagedBillingCapability(capability)
  );

  for (const capability of DASHBOARD_CAPABILITIES) {
    if (roleHasDashboardCapability(role, capability, { hasClerkBillingCapability })) {
      capabilities.push(capability);
    }
  }

  return capabilities;
}

export async function resolveDashboardMembership(
  auth: DashboardAuthParam,
  _legacyUserIdHeader: string | string[] | undefined,
  _dashboardAuthStore: DashboardAuthStore,
  _notFoundMessage: string
): Promise<DashboardMembership> {
  if (!isDashboardRequestContext(auth)) {
    const legacy = readTestOnlyLegacyServiceAuth(auth, _legacyUserIdHeader);

    if (legacy.workspaceId === null || legacy.clerkUserId === null) {
      throw new UnauthorizedException("Dashboard authentication is required");
    }

    const membership = await _dashboardAuthStore.findActiveMembership({
      workspaceId: legacy.workspaceId,
      clerkUserId: legacy.clerkUserId
    });

    if (membership === null) {
      throw new NotFoundException(_notFoundMessage);
    }

    return membership;
  }

  return {
    workspaceId: auth.workspaceId,
    clerkUserId: auth.clerkUserId,
    role: auth.role
  };
}

function readTestOnlyLegacyServiceAuth(
  auth: DashboardAuthParam,
  legacyUserIdHeader: string | string[] | undefined
): {
  readonly workspaceId: string | null;
  readonly clerkUserId: string | null;
} {
  if (process.env.NODE_ENV !== "test") {
    throw new UnauthorizedException("Dashboard authentication is required");
  }

  const legacyWorkspaceId = isDashboardRequestContext(auth) ? undefined : auth;

  return {
    workspaceId: readSingleValue(legacyWorkspaceId) ?? null,
    clerkUserId: readSingleValue(legacyUserIdHeader) ?? null
  };
}

function readSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === "" ? undefined : value;
}
