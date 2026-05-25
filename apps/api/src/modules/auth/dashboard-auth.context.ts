import {
  createParamDecorator,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext
} from "@nestjs/common";
import {
  hasClerkManagedBillingCapability,
  roleHasDashboardCapability,
  type DashboardAuthStore,
  type DashboardCapability,
  type DashboardMembership,
  type DashboardRole
} from "../review-runs/dashboard-auth.store";

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

export function toDashboardServiceAuth(context: DashboardRequestContext): {
  readonly workspaceId: string;
  readonly clerkUserId: string;
} {
  return {
    workspaceId: context.workspaceId,
    clerkUserId: context.clerkUserId
  };
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
  const allCapabilities: readonly DashboardCapability[] = [
    "retry_review_run",
    "trigger_codebase_scan",
    "manage_codebase_scan_findings",
    "manage_repository_configuration",
    "manage_review_policies",
    "manage_sensitive_settings",
    "access_raw_artifacts",
    "manage_billing",
    "manage_github_installations"
  ];
  const hasClerkBillingCapability = clerkCapabilities.some((capability) =>
    hasClerkManagedBillingCapability(capability)
  );

  for (const capability of allCapabilities) {
    if (roleHasDashboardCapability(role, capability, { hasClerkBillingCapability })) {
      capabilities.push(capability);
    }
  }

  return capabilities;
}

export async function resolveDashboardMembership(
  auth: DashboardAuthParam,
  legacyUserIdHeader: string | string[] | undefined,
  dashboardAuthStore: DashboardAuthStore,
  notFoundMessage: string
): Promise<DashboardMembership> {
  if (isDashboardRequestContext(auth)) {
    return {
      workspaceId: auth.workspaceId,
      clerkUserId: auth.clerkUserId,
      role: auth.role
    };
  }

  const workspaceId = readSingleValue(auth) ?? null;
  const clerkUserId = readSingleValue(legacyUserIdHeader) ?? null;

  if (workspaceId === null || clerkUserId === null) {
    throw new UnauthorizedException("Dashboard authentication is required");
  }

  const membership = await dashboardAuthStore.findActiveMembership({ workspaceId, clerkUserId });

  if (membership === null) {
    throw new NotFoundException(notFoundMessage);
  }

  return membership;
}

function readSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === "" ? undefined : value;
}
