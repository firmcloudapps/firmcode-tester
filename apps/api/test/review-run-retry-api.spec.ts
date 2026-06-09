import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import { InMemoryReviewQueueProducer } from "../src/modules/queues/review-queue";
import { PostgresDashboardAuthStore } from "../src/modules/review-runs/dashboard-auth.store";
import { ReviewRunRetryService } from "../src/modules/review-runs/review-run-retry.service";
import { ReviewRunsController } from "../src/modules/review-runs/review-runs.controller";
import { PostgresReviewRunsStore } from "../src/modules/review-runs/review-runs.store";

interface PgPoolLike {
  query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
}

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000101";
const OTHER_WORKSPACE_ID = "00000000-0000-4000-8000-000000000102";
const DEVELOPER_USER_ID = "user_developer";
const OWNER_USER_ID = "user_owner";
const ADMIN_USER_ID = "user_admin";
const VIEWER_USER_ID = "user_viewer";
const ACTIVE_FAILED_RUN_ID = "00000000-0000-4000-8000-000000000301";
const SUCCEEDED_RUN_ID = "00000000-0000-4000-8000-000000000302";
const DETERMINISTIC_FAILED_RUN_ID = "00000000-0000-4000-8000-000000000303";
const OTHER_WORKSPACE_FAILED_RUN_ID = "00000000-0000-4000-8000-000000000304";

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

function createDeterministicUuidFactory(): () => string {
  let index = 800;

  return () => {
    index += 1;
    return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
  };
}

describe("review run retry dashboard API", () => {
  let pool: PgPoolLike;
  let queue: InMemoryReviewQueueProducer;
  let controller: ReviewRunsController;

  beforeEach(async () => {
    pool = createTestPool();
    queue = new InMemoryReviewQueueProducer();
    await runDatabaseMigrations(pool);
    await seedRetryData(pool);

    const reviewRunsStore = new PostgresReviewRunsStore(pool, createDeterministicUuidFactory());
    const retryService = new ReviewRunRetryService(
      reviewRunsStore,
      new PostgresDashboardAuthStore(pool),
      queue
    );
    controller = new ReviewRunsController(reviewRunsStore, new PostgresDashboardAuthStore(pool), retryService);
  });

  afterEach(async () => {
    await pool.end();
  });

  it("queues a retry run for a failed review run in the caller workspace", async () => {
    const response = await controller.retryReviewRun(ACTIVE_FAILED_RUN_ID, WORKSPACE_ID, DEVELOPER_USER_ID);
    const retryRows = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM review_run_retries WHERE original_review_run_id = $1",
      [ACTIVE_FAILED_RUN_ID]
    );

    expect(response).toMatchObject({
      originalRunId: ACTIVE_FAILED_RUN_ID,
      retryRunId: "00000000-0000-4000-8000-000000000801",
      retryJobId: `retry:${ACTIVE_FAILED_RUN_ID}`,
      status: "queued",
      reason: "retry_queued",
      message: "Review retry queued."
    });
    expect(retryRows.rows[0]).toEqual({ count: "1" });
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs.get(`retry:${ACTIVE_FAILED_RUN_ID}`)).toMatchObject({
      reviewRunId: response.retryRunId,
      deliveryId: `retry:${ACTIVE_FAILED_RUN_ID}`,
      triggerEvent: "dashboard.retry"
    });
  });

  it("allows Developer roles to retry failed review runs while Admin remains workspace-management only", async () => {
    await expect(controller.retryReviewRun(ACTIVE_FAILED_RUN_ID, WORKSPACE_ID, DEVELOPER_USER_ID)).resolves.toMatchObject({
      reason: "retry_queued"
    });

    await expect(controller.retryReviewRun(ACTIVE_FAILED_RUN_ID, WORKSPACE_ID, ADMIN_USER_ID)).rejects.toThrow(
      ForbiddenException
    );
  });

  it("rejects malformed IDs, missing runs, non-failed runs, and deterministic validation failures", async () => {
    await expect(controller.retryReviewRun("not-a-uuid", WORKSPACE_ID, DEVELOPER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
    await expect(
      controller.retryReviewRun("00000000-0000-4000-8000-000000009999", WORKSPACE_ID, DEVELOPER_USER_ID)
    ).rejects.toThrow(NotFoundException);
    await expect(controller.retryReviewRun(SUCCEEDED_RUN_ID, WORKSPACE_ID, DEVELOPER_USER_ID)).rejects.toThrow(
      ConflictException
    );
    await expect(
      controller.retryReviewRun(DETERMINISTIC_FAILED_RUN_ID, WORKSPACE_ID, DEVELOPER_USER_ID)
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        reason: "deterministic_validation_failure",
        message: expect.stringContaining("invalid_job_payload")
      })
    });
  });

  it("returns the existing retry without enqueuing a duplicate job", async () => {
    const first = await controller.retryReviewRun(ACTIVE_FAILED_RUN_ID, WORKSPACE_ID, DEVELOPER_USER_ID);
    const second = await controller.retryReviewRun(ACTIVE_FAILED_RUN_ID, WORKSPACE_ID, DEVELOPER_USER_ID);
    const retryRows = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM review_run_retries WHERE original_review_run_id = $1",
      [ACTIVE_FAILED_RUN_ID]
    );

    expect(second).toMatchObject({
      originalRunId: ACTIVE_FAILED_RUN_ID,
      retryRunId: first.retryRunId,
      retryJobId: first.retryJobId,
      status: "queued",
      reason: "duplicate_retry"
    });
    expect(retryRows.rows[0]).toEqual({ count: "1" });
    expect(queue.jobs).toHaveLength(1);
  });

  it("enforces dashboard authentication, workspace membership, and role authorization", async () => {
    await expect(controller.retryReviewRun(ACTIVE_FAILED_RUN_ID, WORKSPACE_ID, undefined)).rejects.toThrow(
      UnauthorizedException
    );
    await expect(controller.retryReviewRun(ACTIVE_FAILED_RUN_ID, OTHER_WORKSPACE_ID, DEVELOPER_USER_ID)).rejects.toThrow(
      NotFoundException
    );
    await expect(controller.retryReviewRun(OTHER_WORKSPACE_FAILED_RUN_ID, WORKSPACE_ID, DEVELOPER_USER_ID)).rejects.toThrow(
      NotFoundException
    );
    await expect(controller.retryReviewRun(ACTIVE_FAILED_RUN_ID, WORKSPACE_ID, ADMIN_USER_ID)).rejects.toThrow(
      ForbiddenException
    );
    expect(queue.jobs).toHaveLength(0);
  });
});

async function seedRetryData(pool: PgPoolLike): Promise<void> {
  await pool.query(
    `
INSERT INTO workspaces (id, identity_provider_org_id, name) VALUES
('${WORKSPACE_ID}', 'org_firmcode', 'Firmcode'),
('${OTHER_WORKSPACE_ID}', 'org_other', 'Other');

INSERT INTO user_profiles (id, identity_provider, provider_user_id) VALUES
('${OWNER_USER_ID}', 'insforge', '${OWNER_USER_ID}'),
('${ADMIN_USER_ID}', 'insforge', '${ADMIN_USER_ID}'),
('${DEVELOPER_USER_ID}', 'insforge', '${DEVELOPER_USER_ID}'),
('${VIEWER_USER_ID}', 'insforge', '${VIEWER_USER_ID}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_memberships (workspace_id, user_id, role, active) VALUES
('${WORKSPACE_ID}', '${OWNER_USER_ID}', 'admin', true),
('${WORKSPACE_ID}', '${ADMIN_USER_ID}', 'admin', true),
('${WORKSPACE_ID}', '${DEVELOPER_USER_ID}', 'developer', true),
('${WORKSPACE_ID}', '${VIEWER_USER_ID}', 'developer', true);

INSERT INTO github_oauth_connections (user_id, github_user_id, github_login, scopes_json) VALUES
('${DEVELOPER_USER_ID}', 701, 'kelly', '[]');

INSERT INTO github_installations (
  id,
  workspace_id,
  installation_id,
  permissions_json
) VALUES
(
  '00000000-0000-4000-8000-000000000201',
  '${WORKSPACE_ID}',
  201,
  '{"pull_requests":"write"}'
),
(
  '00000000-0000-4000-8000-000000000202',
  '${OTHER_WORKSPACE_ID}',
  202,
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
  '00000000-0000-4000-8000-000000000211',
  '00000000-0000-4000-8000-000000000201',
  211,
  'openclaw',
  'firmcode',
  'openclaw/firmcode',
  false,
  'main',
  true
),
(
  '00000000-0000-4000-8000-000000000212',
  '00000000-0000-4000-8000-000000000202',
  212,
  'openclaw',
  'private-fork',
  'openclaw/private-fork',
  true,
  'main',
  true
);

INSERT INTO repository_access (repository_id, user_id, granted_by_user_id) VALUES
('00000000-0000-4000-8000-000000000211', '${DEVELOPER_USER_ID}', '${OWNER_USER_ID}');

INSERT INTO pull_requests (
  id,
  repository_id,
  github_pr_id,
  number,
  title,
  author_login,
  base_ref,
  head_ref,
  base_sha,
  head_sha,
  state,
  draft
) VALUES
(
  '00000000-0000-4000-8000-000000000221',
  '00000000-0000-4000-8000-000000000211',
  221,
  7,
  'Retry failed review',
  'kelly',
  'main',
  'feature/retry',
  'base-sha',
  'head-sha',
  'open',
  false
),
(
  '00000000-0000-4000-8000-000000000222',
  '00000000-0000-4000-8000-000000000212',
  222,
  8,
  'Private retry',
  'octocat',
  'main',
  'feature/private',
  'base-sha',
  'other-head-sha',
  'open',
  false
);

INSERT INTO github_deliveries (delivery_id, event_name, action) VALUES
('delivery-failed', 'pull_request', 'opened'),
('delivery-succeeded', 'pull_request', 'opened'),
('delivery-deterministic', 'pull_request', 'opened'),
('delivery-other-workspace', 'pull_request', 'opened');

INSERT INTO review_runs (
  id,
  repository_id,
  pull_request_id,
  delivery_id,
  trigger_event,
  head_sha,
  status,
  started_at,
  finished_at,
  error_code,
  error_message
) VALUES
(
  '${ACTIVE_FAILED_RUN_ID}',
  '00000000-0000-4000-8000-000000000211',
  '00000000-0000-4000-8000-000000000221',
  'delivery-failed',
  'pull_request.opened',
  'head-sha',
  'failed',
  '2026-05-22T10:00:00.000Z',
  '2026-05-22T10:01:00.000Z',
  'github_request_failed',
  'GitHub timed out'
),
(
  '${SUCCEEDED_RUN_ID}',
  '00000000-0000-4000-8000-000000000211',
  '00000000-0000-4000-8000-000000000221',
  'delivery-succeeded',
  'pull_request.opened',
  'head-sha',
  'succeeded',
  '2026-05-22T10:00:00.000Z',
  '2026-05-22T10:01:00.000Z',
  NULL,
  NULL
),
(
  '${DETERMINISTIC_FAILED_RUN_ID}',
  '00000000-0000-4000-8000-000000000211',
  '00000000-0000-4000-8000-000000000221',
  'delivery-deterministic',
  'pull_request.opened',
  'head-sha',
  'failed',
  '2026-05-22T10:00:00.000Z',
  '2026-05-22T10:01:00.000Z',
  'invalid_job_payload',
  'payload failed validation'
),
(
  '${OTHER_WORKSPACE_FAILED_RUN_ID}',
  '00000000-0000-4000-8000-000000000212',
  '00000000-0000-4000-8000-000000000222',
  'delivery-other-workspace',
  'pull_request.opened',
  'other-head-sha',
  'failed',
  '2026-05-22T10:00:00.000Z',
  '2026-05-22T10:01:00.000Z',
  'github_request_failed',
  'GitHub timed out'
);
`
  );
}

async function resetRetryState(pool: PgPoolLike): Promise<void> {
  await pool.query("DELETE FROM review_run_retries WHERE original_review_run_id = $1", [ACTIVE_FAILED_RUN_ID]);
  await pool.query("DELETE FROM review_runs WHERE id = '00000000-0000-4000-8000-000000000801'");
  await pool.query("DELETE FROM github_deliveries WHERE delivery_id = $1", [`retry:${ACTIVE_FAILED_RUN_ID}`]);
}
