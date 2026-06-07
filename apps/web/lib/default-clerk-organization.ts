import { getServerDashboardAuthSession } from "./clerk-auth";

export const DEFAULT_CLERK_ORGANIZATION_ID = "org_3EGsxXDTl8pWEfV6da6oENrYhRr";
export const DEFAULT_CLERK_ORGANIZATION_NAME = "Firmcode AI";
export const DEFAULT_CLERK_ORGANIZATION_ROLE = "org:developer";

export interface DefaultClerkOrganizationMembershipConfig {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly role: string;
}

export interface DefaultClerkOrganizationMembershipResult {
  readonly status: "already_member" | "created" | "skipped" | "failed";
  readonly organizationId: string | null;
  readonly userId: string | null;
  readonly role: string | null;
  readonly reason: "unauthenticated" | "membership_error" | null;
}

export async function ensureAuthenticatedUserDefaultClerkOrganizationMembership(
  env: Record<string, string | undefined> = process.env
): Promise<DefaultClerkOrganizationMembershipResult> {
  const config = readDefaultClerkOrganizationMembershipConfig(env);
  const session = await getServerDashboardAuthSession(env);

  if (session === null) {
    return {
      status: "skipped",
      organizationId: config.organizationId,
      userId: null,
      role: config.role,
      reason: "unauthenticated"
    };
  }

  return {
    status: "skipped",
    organizationId: config.organizationId,
    userId: session.userId,
    role: config.role,
    reason: null
  };
}

export async function ensureDefaultClerkOrganizationMembership(input: {
  readonly userId: string;
  readonly config: DefaultClerkOrganizationMembershipConfig;
  readonly organizations?: unknown;
}): Promise<DefaultClerkOrganizationMembershipResult> {
  // Workspace creation is now handled by the API-side auth resolver.
  return {
    status: "skipped",
    organizationId: input.config.organizationId,
    userId: input.userId,
    role: input.config.role,
    reason: null
  };
}

export function readDefaultClerkOrganizationMembershipConfig(
  env: Record<string, string | undefined>
): DefaultClerkOrganizationMembershipConfig {
  return {
    organizationId: readEnvironmentValue(env.FIRMCODE_DEFAULT_CLERK_ORGANIZATION_ID) ?? DEFAULT_CLERK_ORGANIZATION_ID,
    organizationName: readEnvironmentValue(env.FIRMCODE_DEFAULT_CLERK_ORGANIZATION_NAME) ?? DEFAULT_CLERK_ORGANIZATION_NAME,
    role: readEnvironmentValue(env.FIRMCODE_DEFAULT_CLERK_ORGANIZATION_ROLE) ?? DEFAULT_CLERK_ORGANIZATION_ROLE
  };
}

function readEnvironmentValue(value: string | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || null;
  }

  return trimmed;
}
