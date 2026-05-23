import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const DASHBOARD_AUTH_STORE = Symbol("DASHBOARD_AUTH_STORE");

export type DashboardRole = "owner" | "admin" | "developer" | "viewer";
export type DashboardCapability = "retry_review_run";

export interface DashboardMembership {
  workspaceId: string;
  clerkUserId: string;
  role: DashboardRole;
}

export interface DashboardAuthStore {
  findActiveMembership(input: { workspaceId: string; clerkUserId: string }): Promise<DashboardMembership | null>;
}

const ROLE_CAPABILITIES: Readonly<Record<DashboardRole, readonly DashboardCapability[]>> = {
  owner: ["retry_review_run"],
  admin: ["retry_review_run"],
  developer: ["retry_review_run"],
  viewer: []
};

interface DashboardMembershipRow {
  readonly workspace_id: string;
  readonly clerk_user_id: string;
  readonly role: DashboardRole;
}

export function roleHasDashboardCapability(role: DashboardRole, capability: DashboardCapability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
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
