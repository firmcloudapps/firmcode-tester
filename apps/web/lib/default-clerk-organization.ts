import { auth, clerkClient } from "@clerk/nextjs/server";

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

interface ClerkOrganizationMembership {
  readonly role: string;
}

interface ClerkOrganizationMembershipList {
  readonly data: readonly ClerkOrganizationMembership[];
}

interface ClerkOrganizationsApi {
  getOrganizationMembershipList(params: {
    readonly organizationId: string;
    readonly userId: string[];
    readonly limit: number;
  }): Promise<ClerkOrganizationMembershipList>;
  createOrganizationMembership(params: {
    readonly organizationId: string;
    readonly userId: string;
    readonly role: string;
  }): Promise<unknown>;
}

export async function ensureAuthenticatedUserDefaultClerkOrganizationMembership(
  env: Record<string, string | undefined> = process.env
): Promise<DefaultClerkOrganizationMembershipResult> {
  const config = readDefaultClerkOrganizationMembershipConfig(env);

  const session = await auth();

  if (session.userId === null) {
    return {
      status: "skipped",
      organizationId: config.organizationId,
      userId: null,
      role: config.role,
      reason: "unauthenticated"
    };
  }

  const client = await clerkClient();

  return ensureDefaultClerkOrganizationMembership({
    userId: session.userId,
    config,
    organizations: client.organizations
  });
}

export async function ensureDefaultClerkOrganizationMembership(input: {
  readonly userId: string;
  readonly config: DefaultClerkOrganizationMembershipConfig;
  readonly organizations: ClerkOrganizationsApi;
}): Promise<DefaultClerkOrganizationMembershipResult> {
  const existing = await findDefaultClerkOrganizationMembership(input);

  if (existing !== null) {
    return {
      status: "already_member",
      organizationId: input.config.organizationId,
      userId: input.userId,
      role: existing.role,
      reason: null
    };
  }

  try {
    await input.organizations.createOrganizationMembership({
      organizationId: input.config.organizationId,
      userId: input.userId,
      role: input.config.role
    });

    return {
      status: "created",
      organizationId: input.config.organizationId,
      userId: input.userId,
      role: input.config.role,
      reason: null
    };
  } catch (error) {
    const recovered = await findDefaultClerkOrganizationMembership(input).catch(() => null);

    if (recovered !== null) {
      return {
        status: "already_member",
        organizationId: input.config.organizationId,
        userId: input.userId,
        role: recovered.role,
        reason: null
      };
    }

    logDefaultClerkOrganizationMembershipFailure({
      organizationId: input.config.organizationId,
      userId: input.userId,
      role: input.config.role,
      error
    });

    return {
      status: "failed",
      organizationId: input.config.organizationId,
      userId: input.userId,
      role: input.config.role,
      reason: "membership_error"
    };
  }
}

function logDefaultClerkOrganizationMembershipFailure(input: {
  readonly organizationId: string;
  readonly userId: string;
  readonly role: string;
  readonly error: unknown;
}): void {
  const message = input.error instanceof Error ? input.error.message : "unknown error";

  console.error(
    JSON.stringify({
      event: "clerk.default_organization.membership_failed",
      organizationId: input.organizationId,
      userId: input.userId,
      role: input.role,
      message
    })
  );
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

async function findDefaultClerkOrganizationMembership(input: {
  readonly userId: string;
  readonly config: DefaultClerkOrganizationMembershipConfig;
  readonly organizations: ClerkOrganizationsApi;
}): Promise<ClerkOrganizationMembership | null> {
  const memberships = await input.organizations.getOrganizationMembershipList({
    organizationId: input.config.organizationId,
    userId: [input.userId],
    limit: 1
  });

  return memberships.data[0] ?? null;
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
