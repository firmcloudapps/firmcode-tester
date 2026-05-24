import type { DashboardWorkspaceRole } from "@firmcode/shared";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const DASHBOARD_AUTH_STORE = Symbol("DASHBOARD_AUTH_STORE");

export interface DashboardWorkspace {
  readonly id: string;
  readonly clerkOrgId: string | null;
  readonly name: string;
}

export interface DashboardMembership {
  readonly workspaceId: string;
  readonly clerkUserId: string;
  readonly role: DashboardWorkspaceRole;
  readonly clerkOrgId: string | null;
  readonly workspaceName: string;
}

export interface DashboardAuthStore {
  findWorkspaceById(workspaceId: string): Promise<DashboardWorkspace | null>;
  findWorkspaceByClerkOrgId(clerkOrgId: string): Promise<DashboardWorkspace | null>;
  findActiveMembership(input: { workspaceId: string; clerkUserId: string }): Promise<DashboardMembership | null>;
}

interface DashboardWorkspaceRow {
  readonly id: string;
  readonly clerk_org_id: string | null;
  readonly name: string;
}

interface DashboardMembershipRow extends DashboardWorkspaceRow {
  readonly workspace_id: string;
  readonly clerk_user_id: string;
  readonly role: DashboardWorkspaceRole;
}

export class EmptyDashboardAuthStore implements DashboardAuthStore {
  async findWorkspaceById(_workspaceId: string): Promise<DashboardWorkspace | null> {
    return null;
  }

  async findWorkspaceByClerkOrgId(_clerkOrgId: string): Promise<DashboardWorkspace | null> {
    return null;
  }

  async findActiveMembership(_input: { workspaceId: string; clerkUserId: string }): Promise<DashboardMembership | null> {
    return null;
  }
}

export class PostgresDashboardAuthStore implements DashboardAuthStore {
  constructor(private readonly database: DatabaseExecutor) {}

  async findWorkspaceById(workspaceId: string): Promise<DashboardWorkspace | null> {
    const result = await this.database.query<DashboardWorkspaceRow>(
      `
SELECT
  id,
  clerk_org_id,
  name
FROM workspaces
WHERE id = $1
`,
      [workspaceId]
    );

    return toWorkspace(result.rows[0]);
  }

  async findWorkspaceByClerkOrgId(clerkOrgId: string): Promise<DashboardWorkspace | null> {
    const result = await this.database.query<DashboardWorkspaceRow>(
      `
SELECT
  id,
  clerk_org_id,
  name
FROM workspaces
WHERE clerk_org_id = $1
`,
      [clerkOrgId]
    );

    return toWorkspace(result.rows[0]);
  }

  async findActiveMembership(input: { workspaceId: string; clerkUserId: string }): Promise<DashboardMembership | null> {
    const result = await this.database.query<DashboardMembershipRow>(
      `
SELECT
  wm.workspace_id,
  wm.clerk_user_id,
  wm.role,
  w.id,
  w.clerk_org_id,
  w.name
FROM workspace_memberships wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.workspace_id = $1
  AND wm.clerk_user_id = $2
  AND wm.active = true
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
      role: row.role,
      clerkOrgId: row.clerk_org_id,
      workspaceName: row.name
    };
  }
}

function toWorkspace(row: DashboardWorkspaceRow | undefined): DashboardWorkspace | null {
  if (row === undefined) {
    return null;
  }

  return {
    id: row.id,
    clerkOrgId: row.clerk_org_id,
    name: row.name
  };
}
