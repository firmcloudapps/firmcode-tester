import { UnauthorizedException } from "@nestjs/common";
import { newDb } from "pg-mem";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import { PostgresDashboardAuthStore } from "../src/modules/review-runs/dashboard-auth.store";
import { SettingsController } from "../src/modules/settings/settings.controller";
import { SettingsService } from "../src/modules/settings/settings.service";
import { PostgresSettingsStore } from "../src/modules/settings/settings.store";

interface PgPoolLike {
  query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
}

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000101";
const OWNER_USER_ID = "user_owner";
const VIEWER_USER_ID = "user_viewer";

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

describe("settings dashboard API", () => {
  let pool: PgPoolLike;
  let controller: SettingsController;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    await seedSettingsData(pool);

    controller = new SettingsController(
      new SettingsService(new PostgresSettingsStore(pool, testConfig), new PostgresDashboardAuthStore(pool))
    );
  });

  afterEach(async () => {
    await pool.end();
  });

  it("returns workspace settings, GitHub installation mapping, and retention policy for an owner", async () => {
    const settings = await controller.getWorkspaceSettings(WORKSPACE_ID, OWNER_USER_ID);

    expect(settings.workspace).toMatchObject({
      id: WORKSPACE_ID,
      name: "Firmcode",
      clerkOrgId: "org_firmcode",
      role: "owner",
      canManageSensitiveSettings: true
    });
    expect(settings.githubApp.installations).toEqual([
      expect.objectContaining({
        installationId: 301,
        accountLogin: "openclaw",
        repositoryCount: 2,
        enabledRepositoryCount: 1
      })
    ]);
    expect(settings.retention).toMatchObject({
      artifactRetentionDays: 21,
      ciLogDays: 14,
      findingMetadataDays: 180
    });
    expect(settings.apiKeys.enabled).toBe(false);
    expect(settings.notifications.enabled).toBe(false);
  });

  it("allows lower roles to fetch read-only settings context without sensitive management capability", async () => {
    const settings = await controller.getWorkspaceSettings(WORKSPACE_ID, VIEWER_USER_ID);

    expect(settings.workspace.role).toBe("viewer");
    expect(settings.workspace.canManageSensitiveSettings).toBe(false);
    expect(settings.githubApp.installations[0]?.repositoryCount).toBe(2);
  });

  it("requires the Clerk dashboard workspace and user headers", async () => {
    await expect(controller.getWorkspaceSettings(WORKSPACE_ID, undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.getWorkspaceSettings(undefined, OWNER_USER_ID)).rejects.toThrow(UnauthorizedException);
    await expect(controller.getWorkspaceSettings(WORKSPACE_ID, "user_missing")).rejects.toThrow(UnauthorizedException);
  });
});

const testConfig: ApiRuntimeConfig = {
  nodeEnv: "test",
  port: 3001,
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
    webhookSecret: null
  },
  github: null,
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
  }
};

async function seedSettingsData(pool: PgPoolLike): Promise<void> {
  await pool.query(
    `
INSERT INTO workspaces (id, clerk_org_id, name) VALUES
('${WORKSPACE_ID}', 'org_firmcode', 'Firmcode');

INSERT INTO workspace_memberships (workspace_id, clerk_user_id, role, active) VALUES
('${WORKSPACE_ID}', '${OWNER_USER_ID}', 'owner', true),
('${WORKSPACE_ID}', '${VIEWER_USER_ID}', 'viewer', true);

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
  '00000000-0000-4000-8000-000000000201',
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
  '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000301',
  202,
  'openclaw',
  'disabled',
  'openclaw/disabled',
  false,
  'main',
  false
);
`
  );
}
