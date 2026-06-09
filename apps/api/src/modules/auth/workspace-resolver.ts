import { randomUUID } from "node:crypto";
import { ForbiddenException, Injectable } from "@nestjs/common";
import type { DefaultWorkspaceConfig } from "@firmcode/shared";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";
import type { DashboardRole } from "../review-runs/dashboard-auth.store";
import type { VerifiedToken } from "./token-verifier";

export const DASHBOARD_WORKSPACE_RESOLVER = Symbol("DASHBOARD_WORKSPACE_RESOLVER");

export interface ResolvedDashboardWorkspace {
  readonly workspaceId: string;
  readonly userId: string;
  readonly orgId: string | null;
  readonly sessionId: string | null;
  readonly role: DashboardRole;
  readonly billingCapabilities: readonly string[];
}

export interface DashboardWorkspaceResolver {
  resolve(input: {
    readonly token: VerifiedToken;
    readonly selectedWorkspaceId: string | null;
  }): Promise<ResolvedDashboardWorkspace>;
}

interface WorkspaceRow {
  readonly id: string;
  readonly clerk_org_id?: string | null;
  readonly identity_provider?: string | null;
}

interface MembershipRow {
  readonly workspace_id: string;
  readonly clerk_user_id?: string | null;
  readonly user_id?: string | null;
  readonly role: DashboardRole;
  readonly active?: boolean;
  readonly clerk_org_id?: string | null;
  readonly identity_provider_org_id?: string | null;
}

@Injectable()
export class PostgresDashboardWorkspaceResolver implements DashboardWorkspaceResolver {
  constructor(
    private readonly database: DatabaseExecutor,
    private readonly uuidFactory: () => string = randomUUID,
    private readonly defaultOrganization: DefaultWorkspaceConfig | null = null
  ) { }

  async resolve(input: {
    readonly token: VerifiedToken;
    readonly selectedWorkspaceId: string | null;
  }): Promise<ResolvedDashboardWorkspace> {
    const userId = input.token.userId;
    const orgId = input.token.orgId;

    await this.ensureUserProfile(input.token);

    if (input.selectedWorkspaceId !== null) {
      const membership = await this.findActiveMembership(input.selectedWorkspaceId, userId);

      if (membership === null) {
        throw new ForbiddenException("Workspace membership is required");
      }

      return toResolvedWorkspace(input.token, membership);
    }

    if (orgId !== null) {
      const workspaceId = await this.ensureOrganizationWorkspace({
        orgId,
        name: `Organization ${orgId}`,
        provider: input.token.provider
      });
      const membership = await this.ensureMembership({
        workspaceId,
        userId,
        role: resolveOrganizationRole(input.token),
        source: resolveOrganizationRoleSource(input.token),
        syncExistingRole: false,
        metadata: {
          orgId,
          orgRole: input.token.orgRole,
          firmcodeRole: input.token.firmcodeRole,
          provider: input.token.provider
        }
      });

      return toResolvedWorkspace(input.token, membership);
    }

    if (this.defaultOrganization !== null) {
      const workspaceId = await this.ensureOrganizationWorkspace({
        orgId: this.defaultOrganization.id,
        name: this.defaultOrganization.name,
        provider: input.token.provider
      });
      const defaultRole = resolveConfiguredOrganizationRole("org:developer");
      const membership = await this.ensureMembership({
        workspaceId,
        userId,
        role: defaultRole,
        source: "default_organization_signup",
        syncExistingRole: false,
        metadata: {
          orgId: this.defaultOrganization.id,
          orgRole: "org:developer",
          firmcodeRole: input.token.firmcodeRole,
          provider: input.token.provider
        }
      });

      return toResolvedWorkspace(
        {
          ...input.token,
          orgId: this.defaultOrganization.id,
          orgRole: "org:developer"
        },
        membership
      );
    }

    const membership = await this.ensurePersonalWorkspace(input.token);
    return toResolvedWorkspace(input.token, membership);
  }

  private async ensureOrganizationWorkspace(input: { readonly orgId: string; readonly name: string; readonly provider?: string }): Promise<string> {
    const identityProvider = input.provider ?? "clerk";
    const existing = await this.database.query<WorkspaceRow>(
      "SELECT id FROM workspaces WHERE identity_provider_org_id = $1 OR clerk_org_id = $1",
      [input.orgId]
    );

    if (existing.rows[0] !== undefined) {
      return existing.rows[0].id;
    }

    const workspaceId = this.uuidFactory();
    const result = await this.database.query<WorkspaceRow>(
      `
INSERT INTO workspaces (id, identity_provider, identity_provider_org_id, clerk_org_id, name)
VALUES ($1, $2, $3, CASE WHEN $2 = 'clerk' THEN $3 ELSE NULL END, $4)
ON CONFLICT (identity_provider_org_id) DO UPDATE SET updated_at = now()
RETURNING id
`,
      [workspaceId, identityProvider, input.orgId, input.name]
    );

    return result.rows[0]?.id ?? workspaceId;
  }

  private async ensurePersonalWorkspace(token: VerifiedToken): Promise<MembershipRow> {
    const userId = token.userId;
    const existing = await this.database.query<MembershipRow>(
      `
SELECT wm.workspace_id, wm.clerk_user_id, wm.user_id, wm.role, w.clerk_org_id, w.identity_provider_org_id
FROM workspace_memberships wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE (wm.clerk_user_id = $1 OR wm.user_id = $1)
  AND wm.active = true
  AND w.clerk_org_id IS NULL
  AND w.identity_provider_org_id IS NULL
ORDER BY wm.created_at ASC
LIMIT 1
`,
      [userId]
    );

    if (existing.rows[0] !== undefined) {
      return this.ensureMembership({
        workspaceId: existing.rows[0].workspace_id,
        userId,
        role: resolvePersonalRole(token),
        source: resolvePersonalRoleSource(token),
        syncExistingRole: false,
        metadata: {
          orgId: null,
          orgRole: null,
          firmcodeRole: token.firmcodeRole,
          provider: token.provider
        }
      });
    }

    const workspaceId = this.uuidFactory();
    await this.database.query(
      `
INSERT INTO workspaces (id, clerk_org_id, identity_provider_org_id, name)
VALUES ($1, NULL, NULL, $2)
`,
      [workspaceId, "Personal workspace"]
    );

    return this.ensureMembership({
      workspaceId,
      userId,
      role: resolvePersonalRole(token),
      source: resolvePersonalRoleSource(token),
      syncExistingRole: false,
      metadata: {
        orgId: null,
        orgRole: null,
        firmcodeRole: token.firmcodeRole,
        provider: token.provider
      }
    });
  }

  private async ensureMembership(input: {
    readonly workspaceId: string;
    readonly userId: string;
    readonly role: DashboardRole;
    readonly source: string;
    readonly syncExistingRole: boolean;
    readonly metadata: Record<string, unknown>;
  }): Promise<MembershipRow> {
    const existing = await this.findMembership(input.workspaceId, input.userId);

    if (existing !== null && existing.active !== true) {
      throw new ForbiddenException("Workspace membership is inactive");
    }

    if (existing !== null && (!input.syncExistingRole || existing.role === input.role)) {
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
  AND (clerk_user_id = $2 OR user_id = $2)
RETURNING workspace_id, clerk_user_id, user_id, role
`,
        [input.workspaceId, input.userId, input.role]
      );
      const membership = result.rows[0] ?? {
        workspace_id: input.workspaceId,
        clerk_user_id: input.userId,
        user_id: input.userId,
        role: input.role
      };

      await this.auditRoleChangeIfElevated({
        workspaceId: input.workspaceId,
        userId: input.userId,
        previousRole: existing.role,
        nextRole: input.role,
        source: input.source,
        metadata: input.metadata
      });

      return membership;
    }

    const result = await this.database.query<MembershipRow>(
      `
INSERT INTO workspace_memberships (workspace_id, clerk_user_id, user_id, role, active)
VALUES ($1, $2, $2, $3, true)
ON CONFLICT (workspace_id, user_id) DO NOTHING
RETURNING workspace_id, clerk_user_id, user_id, role
`,
      [input.workspaceId, input.userId, input.role]
    );

    if (result.rows[0] === undefined) {
      return this.ensureMembership(input);
    }

    await this.auditRoleChangeIfElevated({
      workspaceId: input.workspaceId,
      userId: input.userId,
      previousRole: null,
      nextRole: input.role,
      source: input.source,
      metadata: input.metadata
    });

    return result.rows[0];
  }

  private async findActiveMembership(workspaceId: string, userId: string): Promise<MembershipRow | null> {
    const result = await this.database.query<MembershipRow>(
      `
SELECT wm.workspace_id, wm.clerk_user_id, wm.user_id, wm.role, wm.active, w.clerk_org_id, w.identity_provider_org_id
FROM workspace_memberships wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.workspace_id = $1
  AND (wm.clerk_user_id = $2 OR wm.user_id = $2)
  AND wm.active = true
`,
      [workspaceId, userId]
    );

    return result.rows[0] ?? null;
  }

  private async findMembership(workspaceId: string, userId: string): Promise<MembershipRow | null> {
    const result = await this.database.query<MembershipRow>(
      `
SELECT wm.workspace_id, wm.clerk_user_id, wm.user_id, wm.role, wm.active, w.clerk_org_id, w.identity_provider_org_id
FROM workspace_memberships wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.workspace_id = $1
  AND (wm.clerk_user_id = $2 OR wm.user_id = $2)
`,
      [workspaceId, userId]
    );

    return result.rows[0] ?? null;
  }

  private async auditRoleChangeIfElevated(input: {
    readonly workspaceId: string;
    readonly userId: string;
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
  actor_user_id,
  target_clerk_user_id,
  target_user_id,
  event_type,
  previous_role,
  next_role,
  source,
  metadata_json
) VALUES ($1, $2, $3, $4, $3, $4, 'membership_role_changed', $5, $6, $7, $8::jsonb)
`,
      [
        this.uuidFactory(),
        input.workspaceId,
        input.userId,
        input.userId,
        input.previousRole,
        input.nextRole,
        input.source,
        JSON.stringify(input.metadata)
      ]
    );
  }

  private async ensureUserProfile(token: VerifiedToken): Promise<void> {
    const metadata = {
      provider: token.provider,
      orgId: token.orgId,
      orgRole: token.orgRole,
      firmcodeRole: token.firmcodeRole
    };

    await this.database.query(
      `
INSERT INTO user_profiles (
  id,
  identity_provider,
  provider_user_id,
  email,
  email_verified,
  metadata_json,
  last_seen_at
) VALUES ($1, $2, $1, $3, $4, $5::jsonb, now())
ON CONFLICT (id) DO UPDATE
SET identity_provider = EXCLUDED.identity_provider,
    provider_user_id = EXCLUDED.provider_user_id,
    email = COALESCE(EXCLUDED.email, user_profiles.email),
    email_verified = CASE
      WHEN user_profiles.email_verified THEN true
      ELSE EXCLUDED.email_verified
    END,
    metadata_json = EXCLUDED.metadata_json,
    last_seen_at = now(),
    updated_at = now()
`,
      [
        token.userId,
        token.provider,
        token.email ?? null,
        token.emailVerified ?? false,
        JSON.stringify(metadata)
      ]
    );
  }
}

export class EmptyDashboardWorkspaceResolver implements DashboardWorkspaceResolver {
  async resolve(): Promise<ResolvedDashboardWorkspace> {
    throw new ForbiddenException("Workspace membership is required");
  }
}

function resolvePersonalRole(token: VerifiedToken): DashboardRole {
  return normalizeFirmcodeRole(token.firmcodeRole) ?? "developer";
}

function resolvePersonalRoleSource(token: VerifiedToken): string {
  return hasExplicitFirmcodeRole(token) ? "token_firmcode_role_metadata" : "personal_first_login";
}

function resolveOrganizationRole(token: VerifiedToken): DashboardRole {
  return normalizeClerkOrganizationRole(token.orgRole) ?? normalizeFirmcodeRole(token.firmcodeRole) ?? "developer";
}

function resolveConfiguredOrganizationRole(role: string): DashboardRole {
  return normalizeClerkOrganizationRole(role) ?? normalizeFirmcodeRole(role) ?? "developer";
}

function resolveOrganizationRoleSource(token: VerifiedToken): string {
  if (normalizeClerkOrganizationRole(token.orgRole) !== null) {
    return "organization_role";
  }

  return normalizeFirmcodeRole(token.firmcodeRole) !== null ? "token_firmcode_role_metadata" : "default_developer";
}

function hasExplicitFirmcodeRole(token: VerifiedToken): boolean {
  return normalizeFirmcodeRole(token.firmcodeRole) !== null;
}

function normalizeClerkOrganizationRole(role: string | null): DashboardRole | null {
  switch (role?.toLowerCase()) {
    case "org:admin":
    case "admin":
      return "admin";
    case "org:developer":
    case "developer":
      return "developer";
    default:
      return null;
  }
}

function normalizeFirmcodeRole(role: string | null): DashboardRole | null {
  switch (role?.toLowerCase()) {
    case "admin":
      return "admin";
    case "developer":
      return "developer";
    default:
      return null;
  }
}

function isElevatedRole(role: DashboardRole | null): boolean {
  return role === "admin";
}

function toResolvedWorkspace(token: VerifiedToken, membership: MembershipRow): ResolvedDashboardWorkspace {
  const userId = membership.user_id ?? membership.clerk_user_id ?? token.userId;
  const membershipIncludesWorkspaceOrg =
    Object.prototype.hasOwnProperty.call(membership, "identity_provider_org_id") ||
    Object.prototype.hasOwnProperty.call(membership, "clerk_org_id");

  const orgId = membership.identity_provider_org_id
    ?? membership.clerk_org_id
    ?? (membershipIncludesWorkspaceOrg ? null : token.orgId)
    ?? null;

  return {
    workspaceId: membership.workspace_id,
    userId,
    orgId,
    sessionId: token.sessionId,
    role: membership.role,
    billingCapabilities: token.billingCapabilities
  };
}
