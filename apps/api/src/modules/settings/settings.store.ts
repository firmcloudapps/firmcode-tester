import { randomUUID } from "node:crypto";
import {
  canManageSensitiveWorkspaceSettings,
  type ApiRuntimeConfig,
  type DashboardWorkspaceRole,
  type WorkspaceSettingsMember,
  type WorkspaceSettingsInstallation,
  type WorkspaceSettingsResponse
} from "@firmcode/shared";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const SETTINGS_STORE = Symbol("SETTINGS_STORE");

export interface SettingsStore {
  getWorkspaceSettings(input: WorkspaceSettingsLookup): Promise<WorkspaceSettingsResponse | null>;
  getWorkspaceMember(input: WorkspaceMemberLookup): Promise<WorkspaceSettingsMember | null>;
  countOtherActiveAdmins(input: WorkspaceMemberLookup): Promise<number>;
  updateWorkspaceMemberRole(input: UpdateWorkspaceMemberRoleInput): Promise<WorkspaceSettingsMember | null>;
  updateWorkspaceMemberStatus(input: UpdateWorkspaceMemberStatusInput): Promise<WorkspaceSettingsMember | null>;
}

export interface WorkspaceSettingsLookup {
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: DashboardWorkspaceRole;
}

export interface WorkspaceMemberLookup {
  readonly workspaceId: string;
  readonly targetClerkUserId: string;
  readonly currentClerkUserId: string;
}

export interface UpdateWorkspaceMemberRoleInput extends WorkspaceMemberLookup {
  readonly role: "admin" | "developer";
}

export interface UpdateWorkspaceMemberStatusInput extends WorkspaceMemberLookup {
  readonly active: boolean;
}

interface WorkspaceRow {
  readonly id: string;
  readonly clerk_org_id: string | null;
  readonly name: string;
}

interface MemberRow {
  readonly resolved_user_id: string;
  readonly role: DashboardWorkspaceRole;
  readonly active: boolean;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

interface InstallationRow {
  readonly id: string;
  readonly installation_id: string | number;
  readonly account_login: string | null;
  readonly account_type: string | null;
  readonly repository_count: string | number;
  readonly enabled_repository_count: string | number;
  readonly updated_at: Date | string | null;
}

export class EmptySettingsStore implements SettingsStore {
  constructor(private readonly config: ApiRuntimeConfig) { }

  async getWorkspaceSettings(input: WorkspaceSettingsLookup): Promise<WorkspaceSettingsResponse | null> {
    return {
      workspace: {
        id: input.workspaceId,
        name: "Test workspace",
        clerkOrgId: null,
        role: input.role,
        canManageSensitiveSettings: canManageSensitiveWorkspaceSettings(input.role)
      },
      clerk: buildClerkLinks(),
      githubApp: {
        installUrl: "/github/installations",
        installations: [],
        repositoryConfigurationUrl: "/repositories"
      },
      members: [
        {
          clerkUserId: input.userId,
          role: input.role,
          active: true,
          isCurrentUser: true,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        }
      ],
      retention: buildRetentionPolicy(this.config),
      apiKeys: buildApiKeyPlaceholder(),
      notifications: buildNotificationsPlaceholder()
    };
  }

  async getWorkspaceMember(input: WorkspaceMemberLookup): Promise<WorkspaceSettingsMember | null> {
    return input.targetClerkUserId === input.currentClerkUserId
      ? {
        clerkUserId: input.currentClerkUserId,
        role: "developer",
        active: true,
        isCurrentUser: true,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString()
      }
      : null;
  }

  async countOtherActiveAdmins(): Promise<number> {
    return 1;
  }

  async updateWorkspaceMemberRole(): Promise<WorkspaceSettingsMember | null> {
    return null;
  }

  async updateWorkspaceMemberStatus(): Promise<WorkspaceSettingsMember | null> {
    return null;
  }
}

export class PostgresSettingsStore implements SettingsStore {
  constructor(
    private readonly database: DatabaseExecutor,
    private readonly config: ApiRuntimeConfig,
    private readonly uuidFactory: () => string = randomUUID
  ) { }

  async getWorkspaceSettings(input: WorkspaceSettingsLookup): Promise<WorkspaceSettingsResponse | null> {
    const workspace = await this.loadWorkspace(input.workspaceId);

    if (workspace === null) {
      return null;
    }

    const [installations, members] = await Promise.all([
      this.loadInstallations(input.workspaceId),
      this.loadMembers(input.workspaceId, input.userId)
    ]);

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        clerkOrgId: workspace.clerk_org_id,
        role: input.role,
        canManageSensitiveSettings: canManageSensitiveWorkspaceSettings(input.role)
      },
      clerk: buildClerkLinks(),
      githubApp: {
        installUrl: "/github/installations",
        installations,
        repositoryConfigurationUrl: "/repositories"
      },
      members,
      retention: buildRetentionPolicy(this.config),
      apiKeys: buildApiKeyPlaceholder(),
      notifications: buildNotificationsPlaceholder()
    };
  }

  async getWorkspaceMember(input: WorkspaceMemberLookup): Promise<WorkspaceSettingsMember | null> {
    const result = await this.database.query<MemberRow>(
      `
SELECT COALESCE(user_id, clerk_user_id) AS resolved_user_id, role, active, created_at, updated_at
FROM workspace_memberships
WHERE workspace_id = $1
  AND (clerk_user_id = $2 OR user_id = $2)
`,
      [input.workspaceId, input.targetClerkUserId]
    );

    return result.rows[0] === undefined ? null : toMember(result.rows[0], input.currentClerkUserId);
  }

  async countOtherActiveAdmins(input: WorkspaceMemberLookup): Promise<number> {
    const result = await this.database.query<{ count: string | number }>(
      `
SELECT COUNT(*) AS count
FROM workspace_memberships
WHERE workspace_id = $1
  AND (clerk_user_id <> $2 OR clerk_user_id IS NULL)
  AND (user_id IS NULL OR user_id <> $2)
  AND role = 'admin'
  AND active = true
`,
      [input.workspaceId, input.targetClerkUserId]
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  async updateWorkspaceMemberRole(input: UpdateWorkspaceMemberRoleInput): Promise<WorkspaceSettingsMember | null> {
    const previous = await this.getWorkspaceMember(input);
    const result = await this.database.query<MemberRow>(
      `
UPDATE workspace_memberships
SET role = $3,
    updated_at = now()
WHERE workspace_id = $1
  AND (clerk_user_id = $2 OR user_id = $2)
RETURNING COALESCE(user_id, clerk_user_id) AS resolved_user_id, role, active, created_at, updated_at
`,
      [input.workspaceId, input.targetClerkUserId, input.role]
    );
    const updated = result.rows[0] === undefined ? null : toMember(result.rows[0], input.currentClerkUserId);

    if (updated !== null) {
      await this.auditElevatedRoleChange({
        workspaceId: input.workspaceId,
        actorClerkUserId: input.currentClerkUserId,
        targetClerkUserId: input.targetClerkUserId,
        previousRole: previous?.role ?? null,
        nextRole: input.role,
        source: "settings_member_role"
      });
    }

    return updated;
  }

  async updateWorkspaceMemberStatus(input: UpdateWorkspaceMemberStatusInput): Promise<WorkspaceSettingsMember | null> {
    const previous = await this.getWorkspaceMember(input);
    const result = await this.database.query<MemberRow>(
      `
UPDATE workspace_memberships
SET active = $3,
    updated_at = now()
WHERE workspace_id = $1
  AND (clerk_user_id = $2 OR user_id = $2)
RETURNING COALESCE(user_id, clerk_user_id) AS resolved_user_id, role, active, created_at, updated_at
`,
      [input.workspaceId, input.targetClerkUserId, input.active]
    );
    const updated = result.rows[0] === undefined ? null : toMember(result.rows[0], input.currentClerkUserId);

    if (previous?.role === "admin" && previous.active !== input.active) {
      await this.auditElevatedRoleChange({
        workspaceId: input.workspaceId,
        actorClerkUserId: input.currentClerkUserId,
        targetClerkUserId: input.targetClerkUserId,
        previousRole: input.active ? null : "admin",
        nextRole: input.active ? "admin" : null,
        source: input.active ? "settings_member_restored" : "settings_member_suspended"
      });
    }

    return updated;
  }

  private async loadWorkspace(workspaceId: string): Promise<WorkspaceRow | null> {
    const result = await this.database.query<WorkspaceRow>(
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

    return result.rows[0] ?? null;
  }

  private async loadInstallations(workspaceId: string): Promise<WorkspaceSettingsInstallation[]> {
    const result = await this.database.query<InstallationRow>(
      `
SELECT
  gi.id,
  gi.installation_id,
  gi.account_login,
  gi.account_type,
  COUNT(r.id) AS repository_count,
  SUM(CASE WHEN r.enabled THEN 1 ELSE 0 END) AS enabled_repository_count,
  gi.updated_at
FROM github_installations gi
LEFT JOIN repositories r ON r.installation_id = gi.id
WHERE gi.workspace_id = $1
GROUP BY gi.id, gi.installation_id, gi.account_login, gi.account_type, gi.updated_at
ORDER BY gi.updated_at DESC
`,
      [workspaceId]
    );

    return result.rows.map(toInstallation);
  }

  private async loadMembers(workspaceId: string, currentUserId: string): Promise<WorkspaceSettingsMember[]> {
    const result = await this.database.query<MemberRow>(
      `
SELECT COALESCE(user_id, clerk_user_id) AS resolved_user_id, role, active, created_at, updated_at
FROM workspace_memberships
WHERE workspace_id = $1
ORDER BY active DESC, role ASC, created_at ASC
`,
      [workspaceId]
    );

    return result.rows.map((row) => toMember(row, currentUserId));
  }

  private async auditElevatedRoleChange(input: {
    readonly workspaceId: string;
    readonly actorClerkUserId: string;
    readonly targetClerkUserId: string;
    readonly previousRole: DashboardWorkspaceRole | null;
    readonly nextRole: DashboardWorkspaceRole | null;
    readonly source: string;
  }): Promise<void> {
    if (!isElevatedRole(input.previousRole) && !isElevatedRole(input.nextRole)) {
      return;
    }

    if (input.previousRole === input.nextRole) {
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
) VALUES ($1, $2, $3, $4, 'membership_role_changed', $5, $6, $7, '{}'::jsonb)
`,
      [
        this.uuidFactory(),
        input.workspaceId,
        input.actorClerkUserId,
        input.targetClerkUserId,
        input.previousRole,
        input.nextRole,
        input.source
      ]
    );
  }
}

function buildRetentionPolicy(config: ApiRuntimeConfig): WorkspaceSettingsResponse["retention"] {
  return {
    artifactRetentionDays: config.review.artifactRetentionDays,
    changedFilePatchDays: 30,
    fullSnapshotDays: 14,
    ciLogDays: 14,
    llmArtifactDays: 14,
    semgrepArtifactDays: 30,
    treeSitterArtifactDays: 30,
    findingMetadataDays: 180,
    aggregatedMetricDays: 365
  };
}

function buildClerkLinks(): WorkspaceSettingsResponse["clerk"] {
  return {
    userProfileUrl: "/user-profile",
    organizationProfileUrl: "/organization-profile",
    memberManagementUrl: "/organization-profile/members"
  };
}

function buildApiKeyPlaceholder(): WorkspaceSettingsResponse["apiKeys"] {
  return {
    enabled: false,
    message: "Workspace API key creation is not enabled in the MVP."
  };
}

function buildNotificationsPlaceholder(): WorkspaceSettingsResponse["notifications"] {
  return {
    enabled: false,
    message: "Email and Slack notification routing is planned after review delivery stabilizes."
  };
}

function toInstallation(row: InstallationRow): WorkspaceSettingsInstallation {
  return {
    id: row.id,
    installationId: Number(row.installation_id),
    accountLogin: row.account_login,
    accountType: row.account_type,
    repositoryCount: Number(row.repository_count),
    enabledRepositoryCount: Number(row.enabled_repository_count ?? 0),
    updatedAt: toIsoString(row.updated_at)
  };
}

function toMember(row: MemberRow, currentUserId: string): WorkspaceSettingsMember {
  return {
    clerkUserId: row.resolved_user_id ?? null,
    role: row.role,
    active: row.active,
    isCurrentUser: row.resolved_user_id === currentUserId,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function isElevatedRole(role: DashboardWorkspaceRole | null): boolean {
  return role === "owner" || role === "admin";
}

function toIsoString(value: Date | string | null): string {
  if (value === null) {
    return new Date(0).toISOString();
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
