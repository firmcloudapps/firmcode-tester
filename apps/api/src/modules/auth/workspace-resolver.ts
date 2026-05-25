import { randomUUID } from "node:crypto";
import { ForbiddenException, Injectable } from "@nestjs/common";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";
import type { DashboardRole } from "../review-runs/dashboard-auth.store";
import type { VerifiedClerkToken } from "./clerk-token-verifier";

export const DASHBOARD_WORKSPACE_RESOLVER = Symbol("DASHBOARD_WORKSPACE_RESOLVER");

export interface ResolvedDashboardWorkspace {
  readonly workspaceId: string;
  readonly clerkUserId: string;
  readonly clerkOrgId: string | null;
  readonly sessionId: string | null;
  readonly role: DashboardRole;
  readonly billingCapabilities: readonly string[];
}

export interface DashboardWorkspaceResolver {
  resolve(input: {
    readonly token: VerifiedClerkToken;
    readonly selectedWorkspaceId: string | null;
  }): Promise<ResolvedDashboardWorkspace>;
}

interface WorkspaceRow {
  readonly id: string;
}

interface MembershipRow {
  readonly workspace_id: string;
  readonly clerk_user_id: string;
  readonly role: DashboardRole;
}

@Injectable()
export class PostgresDashboardWorkspaceResolver implements DashboardWorkspaceResolver {
  constructor(private readonly database: DatabaseExecutor) {}

  async resolve(input: {
    readonly token: VerifiedClerkToken;
    readonly selectedWorkspaceId: string | null;
  }): Promise<ResolvedDashboardWorkspace> {
    if (input.selectedWorkspaceId !== null) {
      const membership = await this.findMembership(input.selectedWorkspaceId, input.token.clerkUserId);

      if (membership === null) {
        throw new ForbiddenException("Workspace membership is required");
      }

      return toResolvedWorkspace(input.token, membership);
    }

    if (input.token.clerkOrgId !== null) {
      const workspaceId = await this.ensureOrganizationWorkspace(input.token);
      const membership = await this.ensureMembership({
        workspaceId,
        clerkUserId: input.token.clerkUserId,
        role: mapClerkOrganizationRole(input.token.orgRole)
      });

      return toResolvedWorkspace(input.token, membership);
    }

    const membership = await this.ensurePersonalWorkspace(input.token.clerkUserId);
    return toResolvedWorkspace(input.token, membership);
  }

  private async ensureOrganizationWorkspace(token: VerifiedClerkToken): Promise<string> {
    const existing = await this.database.query<WorkspaceRow>("SELECT id FROM workspaces WHERE clerk_org_id = $1", [token.clerkOrgId]);

    if (existing.rows[0] !== undefined) {
      return existing.rows[0].id;
    }

    const workspaceId = randomUUID();
    const result = await this.database.query<WorkspaceRow>(
      `
INSERT INTO workspaces (id, clerk_org_id, name)
VALUES ($1, $2, $3)
ON CONFLICT (clerk_org_id) DO UPDATE SET updated_at = now()
RETURNING id
`,
      [workspaceId, token.clerkOrgId, `Clerk organization ${token.clerkOrgId}`]
    );

    return result.rows[0]?.id ?? workspaceId;
  }

  private async ensurePersonalWorkspace(clerkUserId: string): Promise<MembershipRow> {
    const existing = await this.database.query<MembershipRow>(
      `
SELECT wm.workspace_id, wm.clerk_user_id, wm.role
FROM workspace_memberships wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.clerk_user_id = $1
  AND wm.active = true
  AND w.clerk_org_id IS NULL
ORDER BY wm.created_at ASC
LIMIT 1
`,
      [clerkUserId]
    );

    if (existing.rows[0] !== undefined) {
      return existing.rows[0];
    }

    const workspaceId = randomUUID();
    await this.database.query(
      `
INSERT INTO workspaces (id, clerk_org_id, name)
VALUES ($1, NULL, $2)
`,
      [workspaceId, "Personal workspace"]
    );

    return this.ensureMembership({ workspaceId, clerkUserId, role: "developer" });
  }

  private async ensureMembership(input: {
    readonly workspaceId: string;
    readonly clerkUserId: string;
    readonly role: DashboardRole;
  }): Promise<MembershipRow> {
    const result = await this.database.query<MembershipRow>(
      `
INSERT INTO workspace_memberships (workspace_id, clerk_user_id, role, active)
VALUES ($1, $2, $3, true)
ON CONFLICT (workspace_id, clerk_user_id) DO UPDATE
SET role = EXCLUDED.role,
    active = true,
    updated_at = now()
RETURNING workspace_id, clerk_user_id, role
`,
      [input.workspaceId, input.clerkUserId, input.role]
    );

    return result.rows[0] ?? {
      workspace_id: input.workspaceId,
      clerk_user_id: input.clerkUserId,
      role: input.role
    };
  }

  private async findMembership(workspaceId: string, clerkUserId: string): Promise<MembershipRow | null> {
    const result = await this.database.query<MembershipRow>(
      `
SELECT workspace_id, clerk_user_id, role
FROM workspace_memberships
WHERE workspace_id = $1
  AND clerk_user_id = $2
  AND active = true
`,
      [workspaceId, clerkUserId]
    );

    return result.rows[0] ?? null;
  }
}

export class EmptyDashboardWorkspaceResolver implements DashboardWorkspaceResolver {
  async resolve(): Promise<ResolvedDashboardWorkspace> {
    throw new ForbiddenException("Workspace membership is required");
  }
}

function mapClerkOrganizationRole(role: string | null): DashboardRole {
  if (role === "org:admin" || role === "admin" || role === "owner" || role === "org:owner") {
    return "admin";
  }

  return "developer";
}

function toResolvedWorkspace(token: VerifiedClerkToken, membership: MembershipRow): ResolvedDashboardWorkspace {
  return {
    workspaceId: membership.workspace_id,
    clerkUserId: membership.clerk_user_id,
    clerkOrgId: token.clerkOrgId,
    sessionId: token.sessionId,
    role: membership.role,
    billingCapabilities: token.billingCapabilities
  };
}
