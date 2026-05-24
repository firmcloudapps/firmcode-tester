import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const DASHBOARD_AUTH_STORE = Symbol("DASHBOARD_AUTH_STORE");

export type DashboardRole = "owner" | "admin" | "developer" | "viewer";
export type DashboardCapability =
  | "retry_review_run"
  | "manage_repository_configuration"
  | "manage_sensitive_settings"
  | "access_raw_artifacts"
  | "manage_billing";

export interface DashboardMembership {
  workspaceId: string;
  clerkUserId: string;
  role: DashboardRole;
}

export interface DashboardAuthStore {
  findActiveMembership(input: { workspaceId: string; clerkUserId: string }): Promise<DashboardMembership | null>;
}

interface DashboardMembershipRow {
  readonly workspace_id: string;
  readonly clerk_user_id: string;
  readonly role: DashboardRole;
}

export function roleHasDashboardCapability(
  role: DashboardRole,
  capability: DashboardCapability,
  options: { hasClerkBillingCapability?: boolean } = {}
): boolean {
  switch (capability) {
    case "retry_review_run":
      return role === "owner" || role === "admin" || role === "developer";
    case "manage_repository_configuration":
      return role === "owner" || role === "admin";
    case "manage_sensitive_settings":
      return role === "owner" || role === "admin";
    case "access_raw_artifacts":
      return role === "owner" || role === "admin" || role === "developer";
    case "manage_billing":
      return role === "owner" || role === "admin" || options.hasClerkBillingCapability === true;
  }
}

export function hasClerkManagedBillingCapability(value: string | string[] | undefined): boolean {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (candidate === undefined || candidate === "") {
    return false;
  }

  return ["manage_billing", "billing_admin", "org:billing:manage", "true"].includes(candidate);
}

export class EmptyDashboardAuthStore implements DashboardAuthStore {
  async findActiveMembership(_input: { workspaceId: string; clerkUserId: string }): Promise<DashboardMembership | null> {
    return null;
  }
}

export class PostgresDashboardAuthStore implements DashboardAuthStore {
  constructor(private readonly database: DatabaseExecutor) {}

  async findActiveMembership(input: { workspaceId: string; clerkUserId: string }): Promise<DashboardMembership | null> {
    const result = await this.database.query<DashboardMembershipRow>(
      `
SELECT
  workspace_id,
  clerk_user_id,
  role
FROM workspace_memberships
WHERE workspace_id = $1
  AND clerk_user_id = $2
  AND active = true
`,
      [input.workspaceId, input.clerkUserId]
    );
    const row = result.rows[0];

    if (row === undefined) {
      return null;
    }

    return {
      workspaceId: row.workspace_id,
      clerkUserId: row.clerk_user_id,
      role: row.role
    };
  }
}
