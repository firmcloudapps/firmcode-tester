import type { DatabaseExecutor } from "../../infrastructure/database/migrations";
import type { DashboardRole } from "../auth/dashboard-authorization.policy";

export const DASHBOARD_AUTH_STORE = Symbol("DASHBOARD_AUTH_STORE");

export {
  DASHBOARD_APP_ROLES,
  DASHBOARD_CAPABILITIES,
  DASHBOARD_ROLE_CAPABILITY_MATRIX,
  hasClerkManagedBillingCapability,
  normalizeDashboardAppRole,
  roleHasDashboardCapability,
  type DashboardAppRole,
  type DashboardCapability,
  type DashboardRole
} from "../auth/dashboard-authorization.policy";

export interface DashboardMembership {
  workspaceId: string;
  userId: string;
  role: DashboardRole;
}

export interface DashboardAuthStore {
  findActiveMembership(input: {
    workspaceId: string;
    userId: string;
  }): Promise<DashboardMembership | null>;
}

interface DashboardMembershipRow {
  readonly workspace_id: string;
  readonly user_id: string;
  readonly role: DashboardRole;
}

export class EmptyDashboardAuthStore implements DashboardAuthStore {
  async findActiveMembership(_input: {
    workspaceId: string;
    userId: string;
  }): Promise<DashboardMembership | null> {
    return null;
  }
}

export class PostgresDashboardAuthStore implements DashboardAuthStore {
  constructor(private readonly database: DatabaseExecutor) { }

  async findActiveMembership(input: {
    workspaceId: string;
    userId: string;
  }): Promise<DashboardMembership | null> {
    const result = await this.database.query<DashboardMembershipRow>(
      `
SELECT
  workspace_id,
  COALESCE(user_id, clerk_user_id) AS user_id,
  role
FROM workspace_memberships
WHERE workspace_id = $1
  AND (user_id = $2 OR clerk_user_id = $2)
  AND active = true
`,
      [input.workspaceId, input.userId]
    );
    const row = result.rows[0];

    if (row === undefined) {
      return null;
    }

    return {
      workspaceId: row.workspace_id,
      userId: row.user_id,
      role: row.role
    };
  }
}
