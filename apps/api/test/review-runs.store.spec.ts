import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import { PostgresReviewRunsStore } from "../src/modules/review-runs/review-runs.store";

interface PgPoolLike {
  query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
}

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

describe("PostgresReviewRunsStore", () => {
  let pool: PgPoolLike;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    await seedReviewRunWithDryRunOutputs(pool);
  });

  afterEach(async () => {
    await pool.end();
  });

  it("exposes dry-run summary and inline outputs for the dashboard API", async () => {
    const detail = await new PostgresReviewRunsStore(pool).getReviewRunDetail(
      "00000000-0000-4000-8000-000000000006"
    );

    expect(detail).toMatchObject({
      id: "00000000-0000-4000-8000-000000000006",
      repositoryFullName: "openclaw/firmcode",
      pullRequestNumber: 7,
      status: "queued",
      findingsCount: 1,
      publishedComments: [
        {
          commentType: "summary",
          githubCommentId: null,
          dryRun: true,
          body: "Would-be summary body"
        },
        {
          commentType: "inline",
          githubReviewId: null,
          githubCommentId: null,
          filePath: "src/server.ts",
          line: 42,
          dryRun: true,
          body: "Would-be inline body"
        }
      ]
    });
  });
});

async function seedReviewRunWithDryRunOutputs(pool: PgPoolLike): Promise<void> {
  await pool.query(
    `
INSERT INTO github_installations (
  id,
  installation_id,
  permissions_json
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  101,
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
) VALUES (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  202,
  'openclaw',
  'firmcode',
  'openclaw/firmcode',
  false,
  'main',
  true
);

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
) VALUES (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  303,
  7,
  'Add dry run mode',
  'kelly',
  'main',
  'feature/dry-run',
  'base-sha',
  'head-sha',
  'open',
  false
);

INSERT INTO github_deliveries (
  delivery_id,
  event_name,
  action
) VALUES (
  'delivery-dry-run',
  'pull_request',
  'opened'
);

INSERT INTO review_runs (
  id,
  repository_id,
  pull_request_id,
  delivery_id,
  trigger_event,
  head_sha,
  status
) VALUES (
  '00000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  'delivery-dry-run',
  'pull_request.opened',
  'head-sha',
  'queued'
);

INSERT INTO findings (
  id,
  review_run_id,
  source,
  category,
  severity,
  confidence,
  file_path,
  start_line,
  end_line,
  title,
  body,
  dedupe_key,
  post_as_inline
) VALUES (
  '00000000-0000-4000-8000-000000000007',
  '00000000-0000-4000-8000-000000000006',
  'llm',
  'security',
  'high',
  'high',
  'src/server.ts',
  42,
  42,
  'Validate shell input',
  'A grounded issue was found.',
  'finding-dedupe-key',
  true
);

INSERT INTO published_comments (
  id,
  review_run_id,
  finding_id,
  github_comment_id,
  github_review_id,
  comment_type,
  file_path,
  line,
  body,
  body_hash,
  dry_run
) VALUES
(
  '00000000-0000-4000-8000-000000000008',
  '00000000-0000-4000-8000-000000000006',
  NULL,
  NULL,
  NULL,
  'summary',
  NULL,
  NULL,
  'Would-be summary body',
  'summary-hash',
  true
),
(
  '00000000-0000-4000-8000-000000000009',
  '00000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000007',
  NULL,
  NULL,
  'inline',
  'src/server.ts',
  42,
  'Would-be inline body',
  'inline-hash',
  true
);
`
  );
}
