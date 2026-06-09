import { createHash, randomUUID } from "crypto";
import type {
  GitHubInstallationListItem,
  GitHubOAuthStatusResponse,
  GitHubRepositorySyncResponse,
  RepositoryListItem
} from "@firmcode/shared";
import type { GitHubInstallationMetadata, GitHubOAuthUser, GitHubRepositoryMetadata } from "../../infrastructure/github/github-app-sync-client";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const GITHUB_DASHBOARD_STORE = Symbol("GITHUB_DASHBOARD_STORE");

export interface GitHubDashboardStore {
  createOAuthState(input: CreateOAuthStateInput): Promise<OAuthStateRecord>;
  consumeOAuthState(input: ConsumeOAuthStateInput): Promise<OAuthStateRecord | null>;
  getOAuthStatus(userId: string): Promise<GitHubOAuthStatusResponse>;
  upsertOAuthConnection(input: UpsertOAuthConnectionInput): Promise<GitHubOAuthStatusResponse>;
  listWorkspaceInstallations(workspaceId: string): Promise<GitHubInstallationListItem[]>;
  findWorkspaceInstallation(input: WorkspaceInstallationLookup): Promise<WorkspaceInstallationRecord | null>;
  findInstallationOwner(installationId: number): Promise<WorkspaceInstallationRecord | null>;
  upsertWorkspaceInstallation(input: UpsertWorkspaceInstallationInput): Promise<WorkspaceInstallationRecord>;
  upsertInstallationRepository(input: UpsertInstallationRepositoryInput): Promise<RepositoryListItem>;
  findWorkspaceRepository(input: WorkspaceRepositoryLookup): Promise<WorkspaceRepositoryRecord | null>;
}

export interface CreateOAuthStateInput {
  readonly state: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly redirectUri: string;
  readonly expiresAt: Date;
}

export interface ConsumeOAuthStateInput {
  readonly state: string;
  readonly workspaceId: string;
  readonly userId: string;
}

export interface OAuthStateRecord {
  readonly workspaceId: string;
  readonly userId: string;
  readonly redirectUri: string;
  readonly expiresAt: Date;
}

export interface UpsertOAuthConnectionInput {
  readonly userId: string;
  readonly user: GitHubOAuthUser;
  readonly scopes: string[];
  readonly accessToken: string;
}

export interface WorkspaceInstallationLookup {
  readonly workspaceId: string;
  readonly installationId: number;
}

export interface WorkspaceInstallationRecord {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly installationId: number;
  readonly accountLogin: string | null;
  readonly accountType: string | null;
  readonly permissionsJson: Record<string, unknown>;
}

export interface UpsertWorkspaceInstallationInput {
  readonly workspaceId: string;
  readonly installation: GitHubInstallationMetadata;
}

export interface UpsertInstallationRepositoryInput {
  readonly installationUuid: string;
  readonly repository: GitHubRepositoryMetadata;
  readonly preserveExistingEnabled?: boolean;
  readonly grantAccessToUserId?: string;
}

export interface WorkspaceRepositoryLookup {
  readonly workspaceId: string;
  readonly repositoryId: string;
}

export interface WorkspaceRepositoryRecord {
  readonly id: string;
  readonly installationUuid: string;
  readonly installationId: number;
  readonly githubRepositoryId: number;
  readonly owner: string;
  readonly name: string;
  readonly fullName: string;
  readonly private: boolean;
  readonly defaultBranch: string;
  readonly enabled: boolean;
}

interface OAuthStateRow {
  readonly workspace_id: string;
  readonly user_id: string;
  readonly redirect_uri: string;
  readonly expires_at: Date | string;
}

interface OAuthConnectionRow {
  readonly github_user_id: string | number;
  readonly github_login: string;
  readonly github_name: string | null;
  readonly github_avatar_url: string | null;
  readonly connected_at: Date | string;
  readonly updated_at: Date | string;
}

interface InstallationRow {
  readonly id: string;
  readonly workspace_id: string | null;
  readonly installation_id: string | number;
  readonly account_login: string | null;
  readonly account_type: string | null;
  readonly permissions_json: Record<string, unknown>;
  readonly repository_count?: string | number | null;
  readonly enabled_repository_count?: string | number | null;
  readonly updated_at?: Date | string | null;
}

interface RepositoryRow {
  readonly id: string;
  readonly installation_id: string;
  readonly github_repository_id: string | number;
  readonly owner: string;
  readonly name: string;
  readonly full_name: string;
  readonly private: boolean;
  readonly default_branch: string;
  readonly enabled: boolean;
  readonly updated_at: Date | string | null;
}

export class EmptyGitHubDashboardStore implements GitHubDashboardStore {
  async createOAuthState(input: CreateOAuthStateInput): Promise<OAuthStateRecord> {
    return {
      workspaceId: input.workspaceId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      expiresAt: input.expiresAt
    };
  }

  async consumeOAuthState(): Promise<OAuthStateRecord | null> {
    return null;
  }

  async getOAuthStatus(): Promise<GitHubOAuthStatusResponse> {
    return { connected: false, user: null };
  }

  async upsertOAuthConnection(input: UpsertOAuthConnectionInput): Promise<GitHubOAuthStatusResponse> {
    const now = new Date().toISOString();
    return {
      connected: true,
      user: {
        githubUserId: input.user.githubUserId,
        login: input.user.login,
        name: input.user.name,
        avatarUrl: input.user.avatarUrl,
        connectedAt: now,
        updatedAt: now
      }
    };
  }

  async listWorkspaceInstallations(): Promise<GitHubInstallationListItem[]> {
    return [];
  }

  async findWorkspaceInstallation(): Promise<WorkspaceInstallationRecord | null> {
    return null;
  }

  async findInstallationOwner(): Promise<WorkspaceInstallationRecord | null> {
    return null;
  }

  async upsertWorkspaceInstallation(input: UpsertWorkspaceInstallationInput): Promise<WorkspaceInstallationRecord> {
    return {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      installationId: input.installation.installationId,
      accountLogin: input.installation.accountLogin,
      accountType: input.installation.accountType,
      permissionsJson: input.installation.permissionsJson
    };
  }

  async upsertInstallationRepository(input: UpsertInstallationRepositoryInput): Promise<RepositoryListItem> {
    return toRepositoryListItem({
      id: randomUUID(),
      installation_id: input.installationUuid,
      github_repository_id: input.repository.githubRepositoryId,
      owner: input.repository.owner,
      name: input.repository.name,
      full_name: input.repository.fullName,
      private: input.repository.private,
      default_branch: input.repository.defaultBranch,
      enabled: true,
      updated_at: new Date()
    });
  }

  async findWorkspaceRepository(): Promise<WorkspaceRepositoryRecord | null> {
    return null;
  }
}

export class PostgresGitHubDashboardStore implements GitHubDashboardStore {
  constructor(
    private readonly database: DatabaseExecutor,
    private readonly createId: () => string = randomUUID
  ) { }

  async createOAuthState(input: CreateOAuthStateInput): Promise<OAuthStateRecord> {
    const result = await this.database.query<OAuthStateRow>(
      `
INSERT INTO github_oauth_states (
  state_hash,
  workspace_id,
  user_id,
  redirect_uri,
  expires_at
) VALUES ($1, $2, $3, $4, $5)
RETURNING workspace_id, user_id, redirect_uri, expires_at
`,
      [hashSecret(input.state), input.workspaceId, input.userId, input.redirectUri, input.expiresAt]
    );

    return toOAuthStateRecord(requireRow(result.rows[0], "github oauth state"));
  }

  async consumeOAuthState(input: ConsumeOAuthStateInput): Promise<OAuthStateRecord | null> {
    const result = await this.database.query<OAuthStateRow>(
      `
UPDATE github_oauth_states
SET consumed_at = now()
WHERE state_hash = $1
  AND workspace_id = $2
  AND user_id = $3
  AND consumed_at IS NULL
  AND expires_at > now()
RETURNING workspace_id, user_id, redirect_uri, expires_at
`,
      [hashSecret(input.state), input.workspaceId, input.userId]
    );

    return result.rows[0] === undefined ? null : toOAuthStateRecord(result.rows[0]);
  }

  async getOAuthStatus(userId: string): Promise<GitHubOAuthStatusResponse> {
    const result = await this.database.query<OAuthConnectionRow>(
      `
SELECT
  github_user_id,
  github_login,
  github_name,
  github_avatar_url,
  connected_at,
  updated_at
FROM github_oauth_connections
WHERE user_id = $1
`,
      [userId]
    );

    return result.rows[0] === undefined ? { connected: false, user: null } : toOAuthStatus(result.rows[0]);
  }

  async upsertOAuthConnection(input: UpsertOAuthConnectionInput): Promise<GitHubOAuthStatusResponse> {
    await this.database.query(
      `
DELETE FROM github_oauth_connections
WHERE github_user_id = $1
  AND user_id <> $2
`,
      [input.user.githubUserId, input.userId]
    );

    const result = await this.database.query<OAuthConnectionRow>(
      `
INSERT INTO github_oauth_connections (
  user_id,
  github_user_id,
  github_login,
  github_name,
  github_avatar_url,
  scopes_json,
  token_hash
) VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (user_id) DO UPDATE
SET github_user_id = EXCLUDED.github_user_id,
    github_login = EXCLUDED.github_login,
    github_name = EXCLUDED.github_name,
    github_avatar_url = EXCLUDED.github_avatar_url,
    scopes_json = EXCLUDED.scopes_json,
    token_hash = EXCLUDED.token_hash,
    updated_at = now()
RETURNING github_user_id, github_login, github_name, github_avatar_url, connected_at, updated_at
`,
      [
        input.userId,
        input.user.githubUserId,
        input.user.login,
        input.user.name,
        input.user.avatarUrl,
        JSON.stringify(input.scopes),
        hashSecret(input.accessToken)
      ]
    );

    return toOAuthStatus(requireRow(result.rows[0], "github oauth connection"));
  }

  async listWorkspaceInstallations(workspaceId: string): Promise<GitHubInstallationListItem[]> {
    const result = await this.database.query<InstallationRow>(
      `
SELECT
  gi.id,
  gi.workspace_id,
  gi.installation_id,
  gi.account_login,
  gi.account_type,
  gi.permissions_json,
  COUNT(r.id) AS repository_count,
  SUM(CASE WHEN r.enabled THEN 1 ELSE 0 END) AS enabled_repository_count,
  gi.updated_at
FROM github_installations gi
LEFT JOIN repositories r ON r.installation_id = gi.id
WHERE gi.workspace_id = $1
GROUP BY gi.id, gi.workspace_id, gi.installation_id, gi.account_login, gi.account_type, gi.permissions_json, gi.updated_at
ORDER BY gi.updated_at DESC
`,
      [workspaceId]
    );

    return result.rows.map(toInstallationListItem);
  }

  async findWorkspaceInstallation(input: WorkspaceInstallationLookup): Promise<WorkspaceInstallationRecord | null> {
    const result = await this.database.query<InstallationRow>(
      `
SELECT id, workspace_id, installation_id, account_login, account_type, permissions_json
FROM github_installations
WHERE workspace_id = $1
  AND installation_id = $2
`,
      [input.workspaceId, input.installationId]
    );

    return result.rows[0] === undefined ? null : toWorkspaceInstallationRecord(result.rows[0]);
  }

  async findInstallationOwner(installationId: number): Promise<WorkspaceInstallationRecord | null> {
    const result = await this.database.query<InstallationRow>(
      `
SELECT id, workspace_id, installation_id, account_login, account_type, permissions_json
FROM github_installations
WHERE installation_id = $1
`,
      [installationId]
    );

    return result.rows[0] === undefined ? null : toWorkspaceInstallationRecord(result.rows[0]);
  }

  async upsertWorkspaceInstallation(input: UpsertWorkspaceInstallationInput): Promise<WorkspaceInstallationRecord> {
    const result = await this.database.query<InstallationRow>(
      `
INSERT INTO github_installations (
  id,
  workspace_id,
  installation_id,
  account_login,
  account_type,
  permissions_json
) VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (installation_id) DO UPDATE
SET workspace_id = EXCLUDED.workspace_id,
    account_login = EXCLUDED.account_login,
    account_type = EXCLUDED.account_type,
    permissions_json = EXCLUDED.permissions_json,
    updated_at = now()
WHERE github_installations.workspace_id IS NULL
   OR github_installations.workspace_id = EXCLUDED.workspace_id
RETURNING id, workspace_id, installation_id, account_login, account_type, permissions_json
`,
      [
        this.createId(),
        input.workspaceId,
        input.installation.installationId,
        input.installation.accountLogin,
        input.installation.accountType,
        JSON.stringify(input.installation.permissionsJson)
      ]
    );

    return toWorkspaceInstallationRecord(requireRow(result.rows[0], "github installation"));
  }

  async upsertInstallationRepository(input: UpsertInstallationRepositoryInput): Promise<RepositoryListItem> {
    const result = await this.database.query<RepositoryRow>(
      `
INSERT INTO repositories (
  id,
  installation_id,
  github_repository_id,
  owner,
  name,
  full_name,
  private,
  default_branch,
  enabled
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
ON CONFLICT (github_repository_id) DO UPDATE
SET installation_id = EXCLUDED.installation_id,
    owner = EXCLUDED.owner,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    private = EXCLUDED.private,
    default_branch = EXCLUDED.default_branch,
    enabled = CASE WHEN $9::boolean THEN repositories.enabled ELSE EXCLUDED.enabled END,
    updated_at = now()
RETURNING *
`,
      [
        this.createId(),
        input.installationUuid,
        input.repository.githubRepositoryId,
        input.repository.owner,
        input.repository.name,
        input.repository.fullName,
        input.repository.private,
        input.repository.defaultBranch,
        input.preserveExistingEnabled === true
      ]
    );

    const repository = toRepositoryListItem(requireRow(result.rows[0], "repository"));

    if (input.grantAccessToUserId !== undefined && input.grantAccessToUserId !== "") {
      await this.grantRepositoryAccess(repository.id, input.grantAccessToUserId);
    }

    return repository;
  }

  private async grantRepositoryAccess(repositoryId: string, userId: string): Promise<void> {
    await this.database.query(
      `
INSERT INTO repository_access (repository_id, user_id, granted_by_user_id)
VALUES ($1, $2, $2)
ON CONFLICT (repository_id, user_id) DO NOTHING
`,
      [repositoryId, userId]
    );
  }

  async findWorkspaceRepository(input: WorkspaceRepositoryLookup): Promise<WorkspaceRepositoryRecord | null> {
    const result = await this.database.query<RepositoryRow & { github_installation_id: string | number }>(
      `
SELECT
  r.*,
  gi.installation_id AS github_installation_id
FROM repositories r
JOIN github_installations gi ON gi.id = r.installation_id
WHERE r.id = $1
  AND gi.workspace_id = $2
`,
      [input.repositoryId, input.workspaceId]
    );

    const row = result.rows[0];

    if (row === undefined) {
      return null;
    }

    return {
      id: row.id,
      installationUuid: row.installation_id,
      installationId: Number(row.github_installation_id),
      githubRepositoryId: Number(row.github_repository_id),
      owner: row.owner,
      name: row.name,
      fullName: row.full_name,
      private: row.private,
      defaultBranch: row.default_branch,
      enabled: row.enabled
    };
  }
}

export function toRepositorySyncResponse(repository: RepositoryListItem): GitHubRepositorySyncResponse {
  return { repository };
}

function toOAuthStateRecord(row: OAuthStateRow): OAuthStateRecord {
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    redirectUri: row.redirect_uri,
    expiresAt: toDate(row.expires_at)
  };
}

function toOAuthStatus(row: OAuthConnectionRow): GitHubOAuthStatusResponse {
  return {
    connected: true,
    user: {
      githubUserId: Number(row.github_user_id),
      login: row.github_login,
      name: row.github_name,
      avatarUrl: row.github_avatar_url,
      connectedAt: toIsoString(row.connected_at),
      updatedAt: toIsoString(row.updated_at)
    }
  };
}

function toInstallationListItem(row: InstallationRow): GitHubInstallationListItem {
  return {
    id: row.id,
    installationId: Number(row.installation_id),
    accountLogin: row.account_login,
    accountType: row.account_type,
    repositoryCount: Number(row.repository_count ?? 0),
    enabledRepositoryCount: Number(row.enabled_repository_count ?? 0),
    updatedAt: toIsoString(row.updated_at ?? null)
  };
}

function toWorkspaceInstallationRecord(row: InstallationRow): WorkspaceInstallationRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    installationId: Number(row.installation_id),
    accountLogin: row.account_login,
    accountType: row.account_type,
    permissionsJson: row.permissions_json
  };
}

function toRepositoryListItem(row: RepositoryRow): RepositoryListItem {
  return {
    id: row.id,
    owner: row.owner,
    name: row.name,
    fullName: row.full_name,
    private: row.private,
    defaultBranch: row.default_branch,
    enabled: row.enabled,
    primaryLanguage: null,
    openFindingsCount: 0,
    openCodebaseFindingsCount: 0,
    lastReview: null,
    codebaseScan: {
      latestScanRunId: null,
      latestScanStatus: null,
      latestScanTrigger: null,
      latestScanCommitSha: null,
      latestScanStartedAt: null,
      latestScanFinishedAt: null,
      latestScanCreatedAt: null,
      openCodebaseFindingsCount: 0
    },
    updatedAt: toIsoString(row.updated_at)
  };
}

function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function requireRow<T>(row: T | undefined, label: string): T {
  if (row === undefined) {
    throw new Error(`${label} was not found`);
  }

  return row;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toIsoString(value: Date | string | null): string {
  if (value === null) {
    return new Date(0).toISOString();
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
