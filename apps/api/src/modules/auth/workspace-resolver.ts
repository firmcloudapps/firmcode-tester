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
  readonly clerk_org_id?: string | null;
}

interface MembershipRow {
  readonly workspace_id: string;
  readonly clerk_user_id: string;
  readonly role: DashboardRole;
  readonly active?: boolean;
  readonly clerk_org_id?: string | null;
}

@Injectable()
export class PostgresDashboardWorkspaceResolver implements DashboardWorkspaceResolver {
  constructor(
    private readonly database: DatabaseExecutor,
    private readonly uuidFactory: () => string = randomUUID
  ) {}

  async resolve(input: {
    readonly token: VerifiedClerkToken;
    readonly selectedWorkspaceId: string | null;
  }): Promise<ResolvedDashboardWorkspace> {
    if (input.selectedWorkspaceId !== null) {
      const membership = await this.findActiveMembership(input.selectedWorkspaceId, input.token.clerkUserId);

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
        role: resolveOrganizationRole(input.token),
        source: resolveOrganizationRoleSource(input.token),
        metadata: {
          clerkOrgId: input.token.clerkOrgId,
          clerkOrgRole: input.token.orgRole,
          firmcodeRole: input.token.firmcodeRole
        }
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

    const workspaceId = this.uuidFactory();
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
SELECT wm.workspace_id, wm.clerk_user_id, wm.role, w.clerk_org_id
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

    const workspaceId = this.uuidFactory();
    await this.database.query(
      `
INSERT INTO workspaces (id, clerk_org_id, name)
VALUES ($1, NULL, $2)
`,
      [workspaceId, "Personal workspace"]
    );

    return this.ensureMembership({
      workspaceId,
      clerkUserId,
      role: "developer",
      source: "personal_first_login",
      metadata: {
        clerkOrgId: null,
        clerkOrgRole: null,
        firmcodeRole: null
      }
    });
  }

  private async ensureMembership(input: {
    readonly workspaceId: string;
    readonly clerkUserId: string;
    readonly role: DashboardRole;
    readonly source: string;
    readonly metadata: Record<string, unknown>;
  }): Promise<MembershipRow> {
    const existing = await this.findMembership(input.workspaceId, input.clerkUserId);

    if (existing !== null && existing.active !== true) {
      throw new ForbiddenException("Workspace membership is inactive");
    }

    if (existing !== null && existing.role === input.role) {
      return existing;
    }

    if (existing !== null) {
      const result = await this.database.query<MembershipRow>(
        `
UPDATE workspace_memberships
SET role = $3,
    active = true,
    updated_at = now()
WHERE workspace_id = $1
  AND clerk_user_id = $2
RETURNING workspace_id, clerk_user_id, role
`,
        [input.workspaceId, input.clerkUserId, input.role]
      );
      const membership = result.rows[0] ?? {
        workspace_id: input.workspaceId,
        clerk_user_id: input.clerkUserId,
        role: input.role
      };

      await this.auditRoleChangeIfElevated({
        ...input,
        previousRole: existing.role,
        nextRole: input.role
      });

      return membership;
    }

    const result = await this.database.query<MembershipRow>(
      `
INSERT INTO workspace_memberships (workspace_id, clerk_user_id, role, active)
VALUES ($1, $2, $3, true)
ON CONFLICT (workspace_id, clerk_user_id) DO NOTHING
RETURNING workspace_id, clerk_user_id, role
`,
      [input.workspaceId, input.clerkUserId, input.role]
    );

    if (result.rows[0] === undefined) {
      return this.ensureMembership(input);
    }

    await this.auditRoleChangeIfElevated({
      ...input,
      previousRole: null,
      nextRole: input.role
    });

    return result.rows[0];
  }

  private async findActiveMembership(workspaceId: string, clerkUserId: string): Promise<MembershipRow | null> {
    const result = await this.database.query<MembershipRow>(
      `
SELECT wm.workspace_id, wm.clerk_user_id, wm.role, wm.active, w.clerk_org_id
FROM workspace_memberships wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.workspace_id = $1
  AND wm.clerk_user_id = $2
  AND wm.active = true
`,
      [workspaceId, clerkUserId]
    );

    return result.rows[0] ?? null;
  }

  private async findMembership(workspaceId: string, clerkUserId: string): Promise<MembershipRow | null> {
    const result = await this.database.query<MembershipRow>(
      `
SELECT wm.workspace_id, wm.clerk_user_id, wm.role, wm.active, w.clerk_org_id
FROM workspace_memberships wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.workspace_id = $1
  AND wm.clerk_user_id = $2
`,
      [workspaceId, clerkUserId]
    );

    return result.rows[0] ?? null;
  }

  private async auditRoleChangeIfElevated(input: {
    readonly workspaceId: string;
    readonly clerkUserId: string;
    readonly previousRole: DashboardRole | null;
    readonly nextRole: DashboardRole;
    readonly source: string;
    readonly metadata: Record<string, unknown>;
  }): Promise<void> {
    if (!isElevatedRole(input.previousRole) && !isElevatedRole(input.nextRole)) {
      return;
    }

    await this.database.query(
      `
INSERT INTO workspace_audit_events (
  id,
  workspace_id,
  actor_clerk_user_id,
  target_clerk_user_id,
  event_type,
  previous_role,
  next_role,
  source,
  metadata_json
) VALUES ($1, $2, $3, $3, 'membership_role_changed', $4, $5, $6, $7::jsonb)
`,
      [
        this.uuidFactory(),
        input.workspaceId,
        input.clerkUserId,
        input.previousRole,
        input.nextRole,
        input.source,
        JSON.stringify(input.metadata)
      ]
    );
  }
}

export class EmptyDashboardWorkspaceResolver implements DashboardWorkspaceResolver {
  async resolve(): Promise<ResolvedDashboardWorkspace> {
    throw new ForbiddenException("Workspace membership is required");
  }
}

function resolveOrganizationRole(token: VerifiedClerkToken): DashboardRole {
  return normalizeFirmcodeRole(token.firmcodeRole) ?? mapClerkOrganizationRole(token.orgRole);
}

function resolveOrganizationRoleSource(token: VerifiedClerkToken): string {
  return normalizeFirmcodeRole(token.firmcodeRole) === null
    ? "clerk_org_role"
    : "clerk_firmcode_role_metadata";
}

function normalizeFirmcodeRole(role: string | null): DashboardRole | null {
  switch (role?.toLowerCase()) {
    case "owner":
    case "admin":
      return "admin";
    case "developer":
    case "member":
      return "developer";
    default:
      return null;
  }
}

function mapClerkOrganizationRole(role: string | null): DashboardRole {
  if (role === "org:admin" || role === "admin" || role === "owner" || role === "org:owner") {
    return "admin";
  }

  return "developer";
}

function isElevatedRole(role: DashboardRole | null): boolean {
  return role === "owner" || role === "admin";
}

function toResolvedWorkspace(token: VerifiedClerkToken, membership: MembershipRow): ResolvedDashboardWorkspace {
  return {
    workspaceId: membership.workspace_id,
    clerkUserId: membership.clerk_user_id,
    clerkOrgId: "clerk_org_id" in membership ? membership.clerk_org_id ?? null : token.clerkOrgId,
    sessionId: token.sessionId,
    role: membership.role,
    billingCapabilities: token.billingCapabilities
  };
}
