import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import {
  CodebaseScanEnqueueService,
  PostgresCodebaseScanTargetStore
} from "../src/modules/codebase-scans/codebase-scan-enqueue.service";
import { PostgresCodebaseScanStore } from "../src/modules/codebase-scans/codebase-scan.store";
import type {
  CodebaseScanJobInput,
  CodebaseScanJobRecord,
  CodebaseScanQueueProducer,
  CodebaseScanScheduleRecord
} from "../src/modules/queues/codebase-scan-queue";
import { InMemoryCodebaseScanQueueProducer } from "../src/modules/queues/codebase-scan-queue";
import { PostgresDashboardAuthStore } from "../src/modules/review-runs/dashboard-auth.store";

interface PgPoolLike {
  query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
}

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000101";
const REPOSITORY_ID = "00000000-0000-4000-8000-000000000201";

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

describe("CodebaseScanEnqueueService", () => {
  let pool: PgPoolLike;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    await seedScanData(pool);
  });

  afterEach(async () => {
    await pool.end();
  });

  it("marks scan runs failed with structured error details when enqueue fails", async () => {
    const service = createService(pool, new FailingCodebaseScanQueueProducer());

    await expect(service.enqueueInitialScanForRepository({ repositoryId: REPOSITORY_ID })).rejects.toThrow(
      /Redis unavailable/
    );

    const rows = await pool.query<{ status: string; error_json: { code?: string; correlationId?: string }; metrics_json: unknown }>(
      "SELECT status, error_json, metrics_json FROM codebase_scan_runs WHERE repository_id = $1",
      [REPOSITORY_ID]
    );

    expect(rows.rows).toEqual([
      expect.objectContaining({
        status: "failed",
        error_json: expect.objectContaining({
          code: "enqueue_failed",
          correlationId: "scan-correlation-1"
        }),
        metrics_json: expect.objectContaining({
          enqueueFailed: true,
          durationMs: expect.any(Number)
        })
      })
    ]);
  });

  it("keeps schedule setup idempotent for successful initial scans", async () => {
    const queue = new InMemoryCodebaseScanQueueProducer();
    const service = createService(pool, queue);

    await service.enqueueInitialScanForRepository({ repositoryId: REPOSITORY_ID });
    await service.enqueueInitialScanForRepository({ repositoryId: REPOSITORY_ID });

    expect(queue.jobs).toHaveLength(1);
    expect(queue.schedules).toHaveLength(1);
  });
});

class FailingCodebaseScanQueueProducer implements CodebaseScanQueueProducer {
  async enqueueCodebaseScan(_input: CodebaseScanJobInput): Promise<CodebaseScanJobRecord> {
    throw new Error("Redis unavailable");
  }

  async scheduleCodebaseScan(_input: CodebaseScanJobInput, cadenceHours: number): Promise<CodebaseScanScheduleRecord> {
    return {
      schedulerId: "scheduler-1",
      jobId: "scheduled-job-1",
      cadenceHours
    };
  }

  async removeCodebaseScanSchedule(): Promise<boolean> {
    return false;
  }
}

function createService(pool: PgPoolLike, queue: CodebaseScanQueueProducer): CodebaseScanEnqueueService {
  return new CodebaseScanEnqueueService(
    new PostgresCodebaseScanStore(pool, deterministicScanId()),
    new PostgresCodebaseScanTargetStore(pool),
    queue,
    new PostgresDashboardAuthStore(pool),
    testConfig,
    deterministicCorrelationId()
  );
}

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

async function seedScanData(pool: PgPoolLike): Promise<void> {
  await pool.query(
    `
INSERT INTO workspaces (id, clerk_org_id, name) VALUES
('${WORKSPACE_ID}', 'org_firmcode', 'Firmcode');

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
  '{"contents":"read"}'
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
);
`
  );
}
