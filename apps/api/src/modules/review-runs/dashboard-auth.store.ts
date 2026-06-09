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
  /** @deprecated Use userId instead. */
  clerkUserId: string;
}

export interface DashboardAuthStore {
  findActiveMembership(input: {
    workspaceId: string;
    userId?: string | null;
    clerkUserId?: string | null;
  }): Promise<DashboardMembership | null>;
}

interface DashboardMembershipRow {
  readonly workspace_id: string;
  readonly user_id: string;
  readonly clerk_user_id: string | null;
  readonly role: DashboardRole;
}

export class EmptyDashboardAuthStore implements DashboardAuthStore {
  async findActiveMembership(_input: {
    workspaceId: string;
    userId?: string | null;
    clerkUserId?: string | null;
  }): Promise<DashboardMembership | null> {
    return null;
  }
}

export class PostgresDashboardAuthStore implements DashboardAuthStore {
  constructor(private readonly database: DatabaseExecutor) { }

  async findActiveMembership(input: {
    workspaceId: string;
    userId?: string | null;
    clerkUserId?: string | null;
  }): Promise<DashboardMembership | null> {
    const userId = input.userId ?? input.clerkUserId ?? null;

    if (userId === null) {
      return null;
    }

    const result = await this.database.query<DashboardMembershipRow>(
      `
SELECT
  workspace_id,
  COALESCE(user_id, clerk_user_id) AS user_id,
  COALESCE(clerk_user_id, user_id) AS clerk_user_id,
  role
FROM workspace_memberships
WHERE workspace_id = $1
  AND (user_id = $2 OR clerk_user_id = $2)
  AND active = true
`,
      [input.workspaceId, userId]
    );
    const row = result.rows[0];

    if (row === undefined) {
      return null;
    }

    return {
      workspaceId: row.workspace_id,
      userId: row.user_id,
      role: row.role,
      clerkUserId: row.clerk_user_id ?? row.user_id
    };
  }
}
