import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import {
  CodebaseScanEnqueueService,
  PostgresCodebaseScanTargetStore
} from "../src/modules/codebase-scans/codebase-scan-enqueue.service";
import { PostgresCodebaseScanStore } from "../src/modules/codebase-scans/codebase-scan.store";
import { RepositoriesController } from "../src/modules/repositories/repositories.controller";
import { RepositoryConfigurationService } from "../src/modules/repositories/repository-configuration.service";
import { PostgresRepositoriesStore } from "../src/modules/repositories/repositories.store";
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

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

describe("repository automation configuration dashboard API", () => {
  let pool: PgPoolLike;
  let controller: RepositoriesController;
  let scanQueue: InMemoryCodebaseScanQueueProducer;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    await seedRepositoryConfigurationData(pool);

    const repositoriesStore = new PostgresRepositoriesStore(pool);
    const dashboardAuthStore = new PostgresDashboardAuthStore(pool);
    scanQueue = new InMemoryCodebaseScanQueueProducer();
    const codebaseScanEnqueueService = new CodebaseScanEnqueueService(
      new PostgresCodebaseScanStore(pool, deterministicScanId()),
      new PostgresCodebaseScanTargetStore(pool),
      scanQueue,
      dashboardAuthStore,
      testConfig,
      deterministicCorrelationId()
    );
    controller = new RepositoriesController(
      repositoriesStore,
      new RepositoryConfigurationService(repositoriesStore, dashboardAuthStore, codebaseScanEnqueueService),
      codebaseScanEnqueueService
    );
  });

  afterEach(async () => {
    await pool.end();
  });

  it("fetches the typed repository configuration for an owner", async () => {
    const configuration = await controller.getRepositoryConfiguration(REPOSITORY_ID, WORKSPACE_ID, OWNER_USER_ID);

    expect(configuration).toMatchObject({
      repositoryId: REPOSITORY_ID,
      automationEnabled: true,
      draftPullRequestReviewsEnabled: false,
      maxInlineComments: 10,
      severityThreshold: "medium",
      semgrepEnabled: true,
      treeSitterEnabled: true,
      ciExplanationEnabled: true,
      infrastructureReviewEnabled: true,
      dryRunEnabled: true,
      updatedByClerkUserId: null
    });
    expect(configuration.createdAt).toEqual(expect.any(String));
    expect(configuration.updatedAt).toEqual(expect.any(String));
  });

  it("allows lower workspace roles to read repository configuration without mutating it", async () => {
    const developerConfiguration = await controller.getRepositoryConfiguration(REPOSITORY_ID, WORKSPACE_ID, DEVELOPER_USER_ID);
    const viewerConfiguration = await controller.getRepositoryConfiguration(REPOSITORY_ID, WORKSPACE_ID, VIEWER_USER_ID);

    expect(developerConfiguration).toMatchObject({
      repositoryId: REPOSITORY_ID,
      automationEnabled: true,
      severityThreshold: "medium"
    });
    expect(viewerConfiguration).toMatchObject({
      repositoryId: REPOSITORY_ID,
      automationEnabled: true,
      severityThreshold: "medium"
    });
  });

  it("allows owners, admins, and developers to disable and enable repository automation", async () => {
    const disabled = await controller.updateRepositoryConfiguration(
      REPOSITORY_ID,
      { automationEnabled: false },
      WORKSPACE_ID,
      DEVELOPER_USER_ID
    );
    const enabled = await controller.updateRepositoryConfiguration(
      REPOSITORY_ID,
      { automationEnabled: true },
      WORKSPACE_ID,
      ADMIN_USER_ID
    );
    const repositoryRows = await pool.query<{ enabled: boolean }>("SELECT enabled FROM repositories WHERE id = $1", [
      REPOSITORY_ID
    ]);

    expect(disabled).toMatchObject({
      automationEnabled: false,
      updatedByClerkUserId: DEVELOPER_USER_ID
    });
    expect(enabled).toMatchObject({
      automationEnabled: true,
      updatedByClerkUserId: ADMIN_USER_ID
    });
    expect(repositoryRows.rows).toEqual([{ enabled: true }]);
    expect(scanQueue.jobs).toHaveLength(1);
    expect(scanQueue.schedules).toHaveLength(1);
    expect(scanQueue.jobs.values().next().value).toMatchObject({
      repositoryId: REPOSITORY_ID,
      trigger: "install",
      commitSha: null
    });
  });

  it("allows owner, admin, and developer roles to manually enqueue one active scan while viewers are read-only", async () => {
    const ownerResponse = await controller.enqueueCodebaseScan(REPOSITORY_ID, WORKSPACE_ID, OWNER_USER_ID);
    const duplicateResponse = await controller.enqueueCodebaseScan(REPOSITORY_ID, WORKSPACE_ID, DEVELOPER_USER_ID);
    const scanRows = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM codebase_scan_runs WHERE repository_id = $1 AND trigger = 'manual'",
      [REPOSITORY_ID]
    );

    expect(ownerResponse).toMatchObject({
      repositoryId: REPOSITORY_ID,
      repositoryFullName: "openclaw/firmcode",
      trigger: "manual",
      status: "queued",
      commitSha: null,
      created: true,
      duplicate: false
    });
    expect(duplicateResponse).toMatchObject({
      scanRunId: ownerResponse.scanRunId,
      jobId: ownerResponse.jobId,
      created: false,
      duplicate: true
    });
    expect(scanRows.rows).toEqual([{ count: "1" }]);
    expect(scanQueue.jobs).toHaveLength(1);

    await expect(controller.enqueueCodebaseScan(REPOSITORY_ID, WORKSPACE_ID, ADMIN_USER_ID)).resolves.toMatchObject({
      duplicate: true
    });
    await expect(controller.enqueueCodebaseScan(REPOSITORY_ID, WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(
      ForbiddenException
    );
  });

  it("enforces manual scan authentication, ownership, and repository enabled state", async () => {
    await expect(controller.enqueueCodebaseScan(REPOSITORY_ID, WORKSPACE_ID, undefined)).rejects.toThrow(
      UnauthorizedException
    );
    await expect(controller.enqueueCodebaseScan(OTHER_REPOSITORY_ID, WORKSPACE_ID, OWNER_USER_ID)).rejects.toThrow(
      NotFoundException
    );

    await controller.updateRepositoryConfiguration(REPOSITORY_ID, { automationEnabled: false }, WORKSPACE_ID, OWNER_USER_ID);

    await expect(controller.enqueueCodebaseScan(REPOSITORY_ID, WORKSPACE_ID, OWNER_USER_ID)).rejects.toThrow(
      ForbiddenException
    );
  });

  it("persists partial configuration changes and preserves existing review policy fields", async () => {
    await controller.updateRepositoryConfiguration(
      REPOSITORY_ID,
      {
        maxInlineComments: 5,
        severityThreshold: "high",
        semgrepEnabled: false,
        dryRunEnabled: false
      },
      WORKSPACE_ID,
      OWNER_USER_ID
    );
    await controller.updateRepositoryConfiguration(REPOSITORY_ID, { automationEnabled: false }, WORKSPACE_ID, OWNER_USER_ID);

    const freshStore = new PostgresRepositoriesStore(pool);
    const persisted = await freshStore.getRepositoryConfiguration({
      repositoryId: REPOSITORY_ID,
      workspaceId: WORKSPACE_ID
    });

    expect(persisted).toMatchObject({
      automationEnabled: false,
      maxInlineComments: 5,
      severityThreshold: "high",
      semgrepEnabled: false,
      dryRunEnabled: false,
      updatedByClerkUserId: OWNER_USER_ID
    });
  });

  it("rejects unknown fields, invalid field types, and invalid numeric bounds", async () => {
    await expect(
      controller.updateRepositoryConfiguration(REPOSITORY_ID, { enabled: false }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRepositoryConfiguration(REPOSITORY_ID, { automationEnabled: "false" }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRepositoryConfiguration(REPOSITORY_ID, { maxInlineComments: -1 }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRepositoryConfiguration(REPOSITORY_ID, { maxInlineComments: 51 }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRepositoryConfiguration(REPOSITORY_ID, { severityThreshold: "urgent" }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
  });

  it("enforces developer repository configuration capabilities while keeping viewers read-only", async () => {
    await expect(controller.getRepositoryConfiguration(REPOSITORY_ID, WORKSPACE_ID, undefined)).rejects.toThrow(
      UnauthorizedException
    );
    await expect(
      controller.updateRepositoryConfiguration(REPOSITORY_ID, { automationEnabled: false }, WORKSPACE_ID, DEVELOPER_USER_ID)
    ).resolves.toMatchObject({
      automationEnabled: false,
      updatedByClerkUserId: DEVELOPER_USER_ID
    });
    await expect(
      controller.updateRepositoryConfiguration(REPOSITORY_ID, { automationEnabled: false }, WORKSPACE_ID, VIEWER_USER_ID)
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.updateRepositoryConfiguration(OTHER_REPOSITORY_ID, { automationEnabled: false }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(NotFoundException);
    await expect(
      controller.updateRepositoryConfiguration(REPOSITORY_ID, { automationEnabled: false }, OTHER_WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(NotFoundException);
  });
});

const testConfig = {
  nodeEnv: "test" as const,
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
    jwtAudience: "firmcode-api",
    webhookSecret: null,
    defaultOrganization: {
      id: "org_3EGsxXDTl8pWEfV6da6oENrYhRr",
      name: "Firmcode AI",
      role: "org:developer"
    }
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
  },
  codebaseScan: {
    defaultCadenceHours: 24
  }
};

function deterministicScanId(): () => string {
  let next = 950;

  return () => `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
}

function deterministicCorrelationId(): () => string {
  let next = 1;

  return () => `scan-correlation-${next++}`;
}

async function seedRepositoryConfigurationData(pool: PgPoolLike): Promise<void> {
  await pool.query(
    `
INSERT INTO workspaces (id, clerk_org_id, name) VALUES
('${WORKSPACE_ID}', 'org_firmcode', 'Firmcode'),
('${OTHER_WORKSPACE_ID}', 'org_other', 'Other');

INSERT INTO workspace_memberships (workspace_id, clerk_user_id, role, active) VALUES
('${WORKSPACE_ID}', '${OWNER_USER_ID}', 'owner', true),
('${WORKSPACE_ID}', '${ADMIN_USER_ID}', 'admin', true),
('${WORKSPACE_ID}', '${DEVELOPER_USER_ID}', 'developer', true),
('${WORKSPACE_ID}', '${VIEWER_USER_ID}', 'viewer', true);

INSERT INTO github_installations (
  id,
  workspace_id,
  installation_id,
  permissions_json
) VALUES
(
  '00000000-0000-4000-8000-000000000301',
  '${WORKSPACE_ID}',
  301,
  '{"pull_requests":"write"}'
),
(
  '00000000-0000-4000-8000-000000000302',
  '${OTHER_WORKSPACE_ID}',
  302,
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
  'openclaw',
  'private-fork',
  'openclaw/private-fork',
  true,
  'main',
  true
);
`
  );
}
