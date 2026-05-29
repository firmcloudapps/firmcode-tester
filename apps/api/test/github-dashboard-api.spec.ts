import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { vi } from "vitest";
import { newDb } from "pg-mem";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import {
  CodebaseScanEnqueueService,
  PostgresCodebaseScanTargetStore
} from "../src/modules/codebase-scans/codebase-scan-enqueue.service";
import { PostgresCodebaseScanStore } from "../src/modules/codebase-scans/codebase-scan.store";
import type {
  GitHubAccountClient,
  GitHubInstallationMetadata,
  GitHubInstallationSyncClient,
  GitHubOAuthTokenExchange,
  GitHubOAuthUser,
  GitHubRepositoryMetadata
} from "../src/infrastructure/github/github-app-sync-client";
import { GitHubDashboardController } from "../src/modules/github/github.controller";
import { GitHubDashboardService } from "../src/modules/github/github.service";
import { PostgresGitHubDashboardStore } from "../src/modules/github/github.store";
import { InMemoryCodebaseScanQueueProducer } from "../src/modules/queues/codebase-scan-queue";
import { PostgresDashboardAuthStore } from "../src/modules/review-runs/dashboard-auth.store";

interface PgPoolLike {
  query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
}

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000101";
const OTHER_WORKSPACE_ID = "00000000-0000-4000-8000-000000000102";
const REPOSITORY_ID = "00000000-0000-4000-8000-000000000201";
const OTHER_REPOSITORY_ID = "00000000-0000-4000-8000-000000000202";
const OWNER_USER_ID = "user_owner";
const ADMIN_USER_ID = "user_admin";
const DEVELOPER_USER_ID = "user_developer";
const VIEWER_USER_ID = "user_viewer";
const UNCONNECTED_USER_ID = "user_unconnected";

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

describe("GitHub OAuth, installation, and repository sync API", () => {
  let pool: PgPoolLike;
  let controller: GitHubDashboardController;
  let accountClient: FakeGitHubAccountClient;
  let installationClient: FakeGitHubInstallationSyncClient;
  let scanQueue: InMemoryCodebaseScanQueueProducer;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    await seedGitHubDashboardData(pool);
    accountClient = new FakeGitHubAccountClient();
    installationClient = new FakeGitHubInstallationSyncClient();
    scanQueue = new InMemoryCodebaseScanQueueProducer();
    const dashboardAuthStore = new PostgresDashboardAuthStore(pool);
    const scanEnqueueService = new CodebaseScanEnqueueService(
      new PostgresCodebaseScanStore(pool, deterministicScanId()),
      new PostgresCodebaseScanTargetStore(pool),
      scanQueue,
      dashboardAuthStore,
      testConfig,
      deterministicCorrelationId()
    );

    controller = new GitHubDashboardController(
      new GitHubDashboardService(
        new PostgresGitHubDashboardStore(pool, deterministicId()),
        dashboardAuthStore,
        accountClient,
        installationClient,
        testConfig,
        scanEnqueueService
      )
    );
  });

  afterEach(async () => {
    await pool.end();
  });

  it("returns missing and connected OAuth status without exposing access tokens", async () => {
    const missing = await controller.getOAuthStatus(WORKSPACE_ID, UNCONNECTED_USER_ID);
    const connected = await controller.getOAuthStatus(WORKSPACE_ID, OWNER_USER_ID);

    expect(missing).toEqual({ connected: false, user: null });
    expect(connected).toMatchObject({
      connected: true,
      user: {
        githubUserId: 91,
        login: "octo-owner"
      }
    });
    expect(JSON.stringify(connected)).not.toContain("gho_");
    expect(JSON.stringify(connected)).not.toContain("token");
  });

  it("validates OAuth callback state, stores safe GitHub identity metadata, and hashes the token", async () => {
    await expect(controller.completeOAuth("code", undefined, WORKSPACE_ID, UNCONNECTED_USER_ID)).rejects.toThrow(
      BadRequestException
    );
    await expect(controller.completeOAuth("code", "bad-state", WORKSPACE_ID, UNCONNECTED_USER_ID)).rejects.toThrow(
      BadRequestException
    );

    const start = await controller.startOAuth(WORKSPACE_ID, UNCONNECTED_USER_ID);
    const state = new URL(start.authorizationUrl).searchParams.get("state");
    expect(state).toEqual(expect.any(String));

    const callback = await controller.completeOAuth("oauth-code", state ?? "", WORKSPACE_ID, UNCONNECTED_USER_ID);
    const rows = await pool.query<{ token_hash: string | null; github_login: string }>(
      "SELECT token_hash, github_login FROM github_oauth_connections WHERE clerk_user_id = $1",
      [UNCONNECTED_USER_ID]
    );

    expect(callback).toMatchObject({
      connected: true,
      user: {
        githubUserId: 701,
        login: "octo-user"
      }
    });
    expect(accountClient.lastExchange).toMatchObject({
      code: "oauth-code",
      redirectUri: "https://firmcode.firmoncloud.com/api/auth/github/callback"
    });
    expect(rows.rows[0]).toMatchObject({
      github_login: "octo-user"
    });
    expect(rows.rows[0]?.token_hash).toEqual(expect.any(String));
    expect(rows.rows[0]?.token_hash).not.toBe("gho_plaintext_secret");
    expect(JSON.stringify(callback)).not.toContain("gho_plaintext_secret");
  });

  it("rebinds a GitHub account to the current Clerk user when it was connected under another user", async () => {
    await pool.query(
      `
INSERT INTO github_oauth_connections (
  clerk_user_id,
  github_user_id,
  github_login,
  github_name,
  github_avatar_url,
  scopes_json,
  token_hash
) VALUES ('user_previous_owner', 701, 'octo-user', 'Octo User', null, '["read:user"]', 'stale-token-hash')
`
    );

    const start = await controller.startOAuth(WORKSPACE_ID, UNCONNECTED_USER_ID);
    const state = new URL(start.authorizationUrl).searchParams.get("state") ?? "";
    const callback = await controller.completeOAuth("oauth-code", state, WORKSPACE_ID, UNCONNECTED_USER_ID);

    const rows = await pool.query<{ clerk_user_id: string }>(
      "SELECT clerk_user_id FROM github_oauth_connections WHERE github_user_id = 701"
    );

    expect(callback).toMatchObject({ connected: true, user: { githubUserId: 701, login: "octo-user" } });
    expect(rows.rows).toEqual([{ clerk_user_id: UNCONNECTED_USER_ID }]);
  });

  it("maps accessible GitHub App installations when OAuth completes", async () => {
    await pool.query("DELETE FROM repositories WHERE installation_id = $1", ["00000000-0000-4000-8000-000000000301"]);
    await pool.query("DELETE FROM github_installations WHERE installation_id = $1", [301]);

    accountClient.accessibleInstallations = [
      {
        installationId: 301,
        accountLogin: "openclaw",
        accountType: "Organization",
        permissionsJson: { metadata: "read", contents: "read", pull_requests: "write" }
      }
    ];

    const start = await controller.startOAuth(WORKSPACE_ID, UNCONNECTED_USER_ID);
    const state = new URL(start.authorizationUrl).searchParams.get("state") ?? "";
    await controller.completeOAuth("oauth-code", state, WORKSPACE_ID, UNCONNECTED_USER_ID);

    const installations = await controller.listInstallations(WORKSPACE_ID, UNCONNECTED_USER_ID);
    const repositoryRows = await pool.query<{ full_name: string }>(
      `
SELECT full_name
FROM repositories r
JOIN github_installations gi ON gi.id = r.installation_id
WHERE gi.installation_id = $1
ORDER BY full_name
`,
      [301]
    );

    expect(installations.installations).toEqual([
      expect.objectContaining({
        installationId: 301,
        accountLogin: "openclaw",
        repositoryCount: 2
      })
    ]);
    expect(repositoryRows.rows).toEqual([{ full_name: "openclaw/firmcode" }, { full_name: "openclaw/new-service" }]);
    expect(installationClient.installationRepositoryFetches).toBe(1);
  });

  it("maps accessible GitHub App installations from the OAuth-during-install callback", async () => {
    await pool.query("DELETE FROM repositories WHERE installation_id = $1", ["00000000-0000-4000-8000-000000000301"]);
    await pool.query("DELETE FROM github_installations WHERE installation_id = $1", [301]);

    accountClient.accessibleInstallations = [
      {
        installationId: 301,
        accountLogin: "openclaw",
        accountType: "Organization",
        permissionsJson: { metadata: "read", contents: "read", pull_requests: "write" }
      }
    ];

    const callback = await controller.completeOAuth("oauth-code", undefined, WORKSPACE_ID, UNCONNECTED_USER_ID, "installation");
    const installations = await controller.listInstallations(WORKSPACE_ID, UNCONNECTED_USER_ID);

    expect(callback).toMatchObject({
      connected: true,
      user: {
        login: "octo-user"
      }
    });
    expect(accountClient.lastExchange).toMatchObject({
      code: "oauth-code",
      redirectUri: "https://firmcode.firmoncloud.com/api/auth/github/callback"
    });
    expect(installations.installations).toEqual([
      expect.objectContaining({
        installationId: 301,
        accountLogin: "openclaw",
        repositoryCount: 2
      })
    ]);
    expect(installationClient.installationRepositoryFetches).toBe(1);
  });

  it("completes the dashboard OAuth connection even when GitHub App installation sync fails", async () => {
    accountClient.failAccessibleInstallations = true;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const start = await controller.startOAuth(WORKSPACE_ID, UNCONNECTED_USER_ID);
    const state = new URL(start.authorizationUrl).searchParams.get("state") ?? "";
    const callback = await controller.completeOAuth("oauth-code", state, WORKSPACE_ID, UNCONNECTED_USER_ID);

    const rows = await pool.query<{ github_login: string }>(
      "SELECT github_login FROM github_oauth_connections WHERE clerk_user_id = $1",
      [UNCONNECTED_USER_ID]
    );

    expect(callback).toMatchObject({ connected: true, user: { login: "octo-user" } });
    expect(rows.rows[0]).toMatchObject({ github_login: "octo-user" });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("[github-oauth]"));
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain("gho_plaintext_secret");

    errorSpy.mockRestore();
  });

  it("completes the OAuth-during-install connection even when GitHub App installation sync fails", async () => {
    accountClient.failAccessibleInstallations = true;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const callback = await controller.completeOAuth("oauth-code", undefined, WORKSPACE_ID, UNCONNECTED_USER_ID, "installation");

    const rows = await pool.query<{ github_login: string }>(
      "SELECT github_login FROM github_oauth_connections WHERE clerk_user_id = $1",
      [UNCONNECTED_USER_ID]
    );

    expect(callback).toMatchObject({ connected: true, user: { login: "octo-user" } });
    expect(rows.rows[0]).toMatchObject({ github_login: "octo-user" });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("[github-oauth]"));

    errorSpy.mockRestore();
  });

  it("does not auto-map installations during OAuth for users without installation management access", async () => {
    accountClient.accessibleInstallations = [
      {
        installationId: 303,
        accountLogin: "new-openclaw",
        accountType: "Organization",
        permissionsJson: { metadata: "read", contents: "read" }
      }
    ];

    const start = await controller.startOAuth(WORKSPACE_ID, UNCONNECTED_USER_ID);
    const state = new URL(start.authorizationUrl).searchParams.get("state") ?? "";
    await pool.query("UPDATE workspace_memberships SET role = 'viewer' WHERE clerk_user_id = $1", [UNCONNECTED_USER_ID]);
    await controller.completeOAuth("oauth-code", state, WORKSPACE_ID, UNCONNECTED_USER_ID);

    const installationRows = await pool.query<{ installation_id: string | number }>(
      "SELECT installation_id FROM github_installations WHERE installation_id = $1",
      [303]
    );

    expect(installationRows.rows).toEqual([]);
    expect(installationClient.installationRepositoryFetches).toBe(0);
  });

  it("requires workspace membership for OAuth and GitHub-backed APIs", async () => {
    await expect(controller.getOAuthStatus(undefined, OWNER_USER_ID)).rejects.toThrow(UnauthorizedException);
    await expect(controller.getOAuthStatus(WORKSPACE_ID, undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.listInstallations(WORKSPACE_ID, "user_missing")).rejects.toThrow(UnauthorizedException);
  });

  it("lists workspace-scoped installations for a caller with connected OAuth", async () => {
    const response = await controller.listInstallations(WORKSPACE_ID, OWNER_USER_ID);

    expect(response.installations).toEqual([
      expect.objectContaining({
        installationId: 301,
        accountLogin: "openclaw",
        repositoryCount: 1,
        enabledRepositoryCount: 1
      })
    ]);
    expect(JSON.stringify(response)).not.toContain("token");
  });

  it("requires connected OAuth before listing or syncing installations", async () => {
    await expect(controller.listInstallations(WORKSPACE_ID, UNCONNECTED_USER_ID)).rejects.toThrow(ForbiddenException);
    await expect(controller.syncInstallations({ installationId: 301 }, WORKSPACE_ID, UNCONNECTED_USER_ID)).rejects.toThrow(
      ForbiddenException
    );
  });

  it("syncs installation repository metadata idempotently with GitHub App installation data", async () => {
    const first = await controller.syncInstallations({ installationId: 301 }, WORKSPACE_ID, OWNER_USER_ID);
    const second = await controller.syncInstallations({ installationId: 301 }, WORKSPACE_ID, OWNER_USER_ID);
    const repositoryRows = await pool.query<{ full_name: string; enabled: boolean }>(
      `
SELECT full_name, enabled
FROM repositories
WHERE installation_id = '00000000-0000-4000-8000-000000000301'
ORDER BY full_name
`
    );

    expect(first.syncedRepositoryCount).toBe(2);
    expect(second.syncedRepositoryCount).toBe(2);
    expect(repositoryRows.rows).toEqual([
      { full_name: "openclaw/firmcode", enabled: true },
      { full_name: "openclaw/new-service", enabled: true }
    ]);
    expect(installationClient.installationRepositoryFetches).toBe(2);
    expect(scanQueue.jobs).toHaveLength(2);
    expect(scanQueue.schedules).toHaveLength(2);

    const scanRows = await pool.query<{ repository_id: string; trigger: string; status: string; commit_sha: string | null }>(
      "SELECT repository_id, trigger, status, commit_sha FROM codebase_scan_runs ORDER BY repository_id"
    );

    expect(scanRows.rows).toEqual([
      {
        repository_id: REPOSITORY_ID,
        trigger: "install",
        status: "queued",
        commit_sha: null
      },
      {
        repository_id: "00000000-0000-4000-8000-000000000902",
        trigger: "install",
        status: "queued",
        commit_sha: null
      }
    ]);
  });

  it("syncs a single workspace-owned repository and preserves automation state", async () => {
    installationClient.repositories.set(301, [
      {
        githubRepositoryId: 201,
        owner: "openclaw",
        name: "firmcode-renamed",
        fullName: "openclaw/firmcode-renamed",
        private: true,
        defaultBranch: "trunk"
      }
    ]);
    await pool.query("UPDATE repositories SET enabled = false WHERE id = $1", [REPOSITORY_ID]);

    const response = await controller.syncRepository(REPOSITORY_ID, WORKSPACE_ID, ADMIN_USER_ID);
    const rows = await pool.query<{ full_name: string; enabled: boolean; default_branch: string }>(
      "SELECT full_name, enabled, default_branch FROM repositories WHERE id = $1",
      [REPOSITORY_ID]
    );

    expect(response.repository).toMatchObject({
      id: REPOSITORY_ID,
      fullName: "openclaw/firmcode-renamed",
      private: true,
      defaultBranch: "trunk",
      enabled: false
    });
    expect(rows.rows).toEqual([{ full_name: "openclaw/firmcode-renamed", enabled: false, default_branch: "trunk" }]);
    expect(scanQueue.jobs).toHaveLength(0);
    expect(scanQueue.schedules).toHaveLength(0);
  });

  it("allows Developer installation sync and denies cross-workspace or missing installation sync attempts", async () => {
    await expect(controller.syncInstallations({ installationId: 301 }, WORKSPACE_ID, DEVELOPER_USER_ID)).resolves.toMatchObject({
      syncedRepositoryCount: 2
    });
    await expect(controller.syncRepository(REPOSITORY_ID, WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(ForbiddenException);
    await expect(controller.syncRepository(OTHER_REPOSITORY_ID, WORKSPACE_ID, OWNER_USER_ID)).rejects.toThrow(
      NotFoundException
    );
    await expect(controller.syncInstallations({ installationId: 999 }, WORKSPACE_ID, OWNER_USER_ID)).rejects.toThrow(
      NotFoundException
    );
    await expect(controller.syncInstallations({ installationId: 302 }, WORKSPACE_ID, OWNER_USER_ID)).rejects.toThrow(
      NotFoundException
    );
  });

  it("rejects malformed installation IDs and repository IDs", async () => {
    await expect(controller.connectInstallation("not-a-number", WORKSPACE_ID, OWNER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
    await expect(controller.syncInstallations({ installationId: "abc" }, WORKSPACE_ID, OWNER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
    await expect(controller.syncRepository("not-a-uuid", WORKSPACE_ID, OWNER_USER_ID)).rejects.toThrow(BadRequestException);
  });

  it("keeps installation callback workspace-scoped and denies installations owned elsewhere", async () => {
    await expect(controller.connectInstallation("302", WORKSPACE_ID, OWNER_USER_ID)).rejects.toThrow(ForbiddenException);

    const response = await controller.connectInstallation("303", WORKSPACE_ID, OWNER_USER_ID);

    expect(response.installations.map((installation) => installation.installationId)).toContain(303);
    expect(response.syncedRepositoryCount).toBe(1);
  });

  it("surfaces GitHub adapter failures without writing partial repository rows", async () => {
    installationClient.failRepositories = true;

    await expect(controller.syncInstallations({ installationId: 301 }, WORKSPACE_ID, OWNER_USER_ID)).rejects.toThrow(
      /GitHub repository list failed/
    );

    const rows = await pool.query<{ full_name: string }>(
      "SELECT full_name FROM repositories WHERE github_repository_id = 203"
    );
    expect(rows.rows).toEqual([]);
  });

  it("does not return secrets or plaintext tokens from callback, installation, or repository sync responses", async () => {
    const start = await controller.startOAuth(WORKSPACE_ID, UNCONNECTED_USER_ID);
    const state = new URL(start.authorizationUrl).searchParams.get("state") ?? "";
    const callback = await controller.completeOAuth("oauth-code", state, WORKSPACE_ID, UNCONNECTED_USER_ID);
    const installations = await controller.syncInstallations({ installationId: 301 }, WORKSPACE_ID, OWNER_USER_ID);
    const repository = await controller.syncRepository(REPOSITORY_ID, WORKSPACE_ID, OWNER_USER_ID);
    const serialized = JSON.stringify({ callback, installations, repository });

    expect(serialized).not.toContain("gho_plaintext_secret");
    expect(serialized).not.toContain("installation-token");
    expect(serialized).not.toContain("token_hash");
    expect(serialized).not.toContain("permissions_json");
  });
});

class FakeGitHubAccountClient implements GitHubAccountClient {
  lastExchange: { code: string; redirectUri: string } | null = null;
  accessibleInstallations: GitHubInstallationMetadata[] = [];
  failAccessibleInstallations = false;

  async exchangeOAuthCode(input: { code: string; redirectUri: string }): Promise<GitHubOAuthTokenExchange> {
    this.lastExchange = input;
    return {
      accessToken: "gho_plaintext_secret",
      scopes: ["read:user", "user:email"]
    };
  }

  async fetchOAuthUser(_accessToken: string): Promise<GitHubOAuthUser> {
    return {
      githubUserId: 701,
      login: "octo-user",
      name: "Octo User",
      avatarUrl: "https://avatars.example/octo-user.png"
    };
  }

  async fetchAccessibleInstallations(_accessToken: string): Promise<GitHubInstallationMetadata[]> {
    if (this.failAccessibleInstallations) {
      throw new Error("GitHub App installation sync failed");
    }

    return this.accessibleInstallations;
  }
}

class FakeGitHubInstallationSyncClient implements GitHubInstallationSyncClient {
  failRepositories = false;
  installationRepositoryFetches = 0;
  installations = new Map<number, GitHubInstallationMetadata>([
    [
      301,
      {
        installationId: 301,
        accountLogin: "openclaw",
        accountType: "Organization",
        permissionsJson: { metadata: "read", contents: "read", pull_requests: "write" }
      }
    ],
    [
      302,
      {
        installationId: 302,
        accountLogin: "other",
        accountType: "Organization",
        permissionsJson: { metadata: "read" }
      }
    ],
    [
      303,
      {
        installationId: 303,
        accountLogin: "new-openclaw",
        accountType: "Organization",
        permissionsJson: { metadata: "read", contents: "read" }
      }
    ]
  ]);
  repositories = new Map<number, GitHubRepositoryMetadata[]>([
    [
      301,
      [
        {
          githubRepositoryId: 201,
          owner: "openclaw",
          name: "firmcode",
          fullName: "openclaw/firmcode",
          private: false,
          defaultBranch: "main"
        },
        {
          githubRepositoryId: 203,
          owner: "openclaw",
          name: "new-service",
          fullName: "openclaw/new-service",
          private: false,
          defaultBranch: "main"
        }
      ]
    ],
    [
      303,
      [
        {
          githubRepositoryId: 30301,
          owner: "new-openclaw",
          name: "api",
          fullName: "new-openclaw/api",
          private: false,
          defaultBranch: "main"
        }
      ]
    ]
  ]);

  async fetchInstallation(installationId: number): Promise<GitHubInstallationMetadata> {
    const installation = this.installations.get(installationId);

    if (installation === undefined) {
      throw new Error("GitHub installation lookup failed");
    }

    return installation;
  }

  async fetchInstallationRepositories(installationId: number): Promise<GitHubRepositoryMetadata[]> {
    if (this.failRepositories) {
      throw new Error("GitHub repository list failed");
    }

    this.installationRepositoryFetches += 1;
    return this.repositories.get(installationId) ?? [];
  }
}

const testConfig: ApiRuntimeConfig = {
  nodeEnv: "test",
  port: 3001,
  publicAppUrl: "https://firmcode.firmoncloud.com",
  publicApiUrl: "https://firmcodeapi.firmoncloud.com",
  corsAllowedOrigins: [],
  database: {
    url: "postgres://firmcode:secret@localhost:5432/firmcode",
    ssl: false,
    redactedUrl: "postgres://firmcode:REDACTED@localhost:5432/firmcode"
  },
  queue: {
    redisUrl: "redis://localhost:6379",
    redactedRedisUrl: "redis://localhost:6379/"
  },
  clerk: {
    secretKey: "sk_test_example",
    jwtAudience: "firmcode-api",
    webhookSecret: null
  },
  github: {
    appId: 123,
    privateKey: "private-key",
    webhookSecret: "webhook-secret",
    clientId: "github-client-id",
    clientSecret: "github-client-secret",
    redacted: {
      appId: "REDACTED",
      privateKey: "REDACTED",
      webhookSecret: "REDACTED",
      clientId: "REDACTED",
      clientSecret: "REDACTED"
    },
    toJSON() {
      return this.redacted;
    }
  },
  review: {
    dryRun: true,
    skipDraftPullRequests: true,
    ciLogMaxBytes: 20_000,
    artifactRetentionDays: 21,
    largePullRequest: {
      maxChangedFiles: 30,
      maxDiffBytes: 120_000,
      maxChangedLines: 2_000,
      maxEstimatedTokens: 24_000,
      maxFilesAfterFiltering: 20,
      maxSemgrepRuntimeMs: 60_000,
      summaryOnlyDiffBytes: 500_000,
      summaryOnlyChangedLines: 8_000,
      summaryOnlyEstimatedTokens: 80_000,
      maxFullContextFiles: 8
    }
  },
  codebaseScan: {
    defaultCadenceHours: 24
  }
};

function deterministicId(): () => string {
  let next = 900;

  return () => `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
}

function deterministicScanId(): () => string {
  let next = 950;

  return () => `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
}

function deterministicCorrelationId(): () => string {
  let next = 1;

  return () => `scan-correlation-${next++}`;
}

async function seedGitHubDashboardData(pool: PgPoolLike): Promise<void> {
  await pool.query(
    `
INSERT INTO workspaces (id, clerk_org_id, name) VALUES
('${WORKSPACE_ID}', 'org_firmcode', 'Firmcode'),
('${OTHER_WORKSPACE_ID}', 'org_other', 'Other');

INSERT INTO workspace_memberships (workspace_id, clerk_user_id, role, active) VALUES
('${WORKSPACE_ID}', '${OWNER_USER_ID}', 'owner', true),
('${WORKSPACE_ID}', '${ADMIN_USER_ID}', 'admin', true),
('${WORKSPACE_ID}', '${DEVELOPER_USER_ID}', 'developer', true),
('${WORKSPACE_ID}', '${VIEWER_USER_ID}', 'viewer', true),
('${WORKSPACE_ID}', '${UNCONNECTED_USER_ID}', 'owner', true),
('${OTHER_WORKSPACE_ID}', '${OWNER_USER_ID}', 'owner', true);

INSERT INTO github_oauth_connections (
  clerk_user_id,
  github_user_id,
  github_login,
  github_name,
  github_avatar_url,
  scopes_json,
  token_hash
) VALUES
('${OWNER_USER_ID}', 91, 'octo-owner', 'Octo Owner', 'https://avatars.example/octo-owner.png', '["read:user"]', 'hashed-owner-token'),
('${ADMIN_USER_ID}', 92, 'octo-admin', 'Octo Admin', null, '["read:user"]', 'hashed-admin-token'),
('${DEVELOPER_USER_ID}', 93, 'octo-dev', null, null, '["read:user"]', 'hashed-dev-token'),
('${VIEWER_USER_ID}', 94, 'octo-viewer', null, null, '["read:user"]', 'hashed-viewer-token');

INSERT INTO github_installations (
  id,
  workspace_id,
  installation_id,
  account_login,
  account_type,
  permissions_json
) VALUES
(
  '00000000-0000-4000-8000-000000000301',
  '${WORKSPACE_ID}',
  301,
  'openclaw',
  'Organization',
  '{"pull_requests":"write"}'
),
(
  '00000000-0000-4000-8000-000000000302',
  '${OTHER_WORKSPACE_ID}',
  302,
  'other',
  'Organization',
  '{"metadata":"read"}'
);

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
) VALUES
(
  '${REPOSITORY_ID}',
  '00000000-0000-4000-8000-000000000301',
  201,
  'openclaw',
  'firmcode',
  'openclaw/firmcode',
  false,
  'main',
  true
),
(
  '${OTHER_REPOSITORY_ID}',
  '00000000-0000-4000-8000-000000000302',
  202,
  'other',
  'private-fork',
  'other/private-fork',
  true,
  'main',
  true
);
`
  );
}
