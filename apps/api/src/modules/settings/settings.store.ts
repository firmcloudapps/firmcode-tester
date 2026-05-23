import {
  canManageSensitiveWorkspaceSettings,
  type ApiRuntimeConfig,
  type DashboardWorkspaceRole,
  type WorkspaceSettingsInstallation,
  type WorkspaceSettingsResponse
} from "@firmcode/shared";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const SETTINGS_STORE = Symbol("SETTINGS_STORE");

export interface SettingsStore {
  getWorkspaceSettings(input: WorkspaceSettingsLookup): Promise<WorkspaceSettingsResponse | null>;
}

export interface WorkspaceSettingsLookup {
  readonly workspaceId: string;
  readonly clerkUserId: string;
  readonly role: DashboardWorkspaceRole;
}

interface WorkspaceRow {
  readonly id: string;
  readonly clerk_org_id: string | null;
  readonly name: string;
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
  constructor(private readonly config: ApiRuntimeConfig) {}

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
      retention: buildRetentionPolicy(this.config),
      apiKeys: buildApiKeyPlaceholder(),
      notifications: buildNotificationsPlaceholder()
    };
  }
}

export class PostgresSettingsStore implements SettingsStore {
  constructor(
    private readonly database: DatabaseExecutor,
    private readonly config: ApiRuntimeConfig
  ) {}

  async getWorkspaceSettings(input: WorkspaceSettingsLookup): Promise<WorkspaceSettingsResponse | null> {
    const workspace = await this.loadWorkspace(input.workspaceId);

    if (workspace === null) {
      return null;
    }

    const installations = await this.loadInstallations(input.workspaceId);

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
      retention: buildRetentionPolicy(this.config),
      apiKeys: buildApiKeyPlaceholder(),
      notifications: buildNotificationsPlaceholder()
    };
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

function toIsoString(value: Date | string | null): string {
  if (value === null) {
    return new Date(0).toISOString();
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
