import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../../../src/infrastructure/database/migrations";
import { PostgresGitHubWebhookStore } from "../../../src/modules/webhooks/github/postgres-github-webhook.store";

interface PgPoolLike {
  query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
}

const EXPECTED_TABLES = [
  "analysis_artifacts",
  "changed_files",
  "findings",
  "github_deliveries",
  "github_installations",
  "published_comments",
  "pull_requests",
  "repositories",
  "review_run_retries",
  "review_runs",
  "schema_migrations",
  "workspace_memberships",
  "workspaces"
];

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

function createDeterministicUuidFactory(): () => string {
  let index = 0;

  return () => {
    index += 1;
    return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
  };
}

async function insertMinimalReviewRun(pool: PgPoolLike): Promise<void> {
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
  head_sha
) VALUES (
  '00000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  'delivery-dry-run',
  'pull_request.opened',
  'head-sha'
);
`
  );
}

describe("database migrations", () => {
  let pool: PgPoolLike;

  beforeEach(() => {
    pool = createTestPool();
  });

  afterEach(async () => {
    await pool.end();
  });

  it("runs from a clean database and records applied migrations", async () => {
    const appliedMigrationIds = await runDatabaseMigrations(pool);
    const secondRunMigrationIds = await runDatabaseMigrations(pool);
    const tables = await pool.query<{ table_name: string }>(
      `
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name
`
    );
    const applied = await pool.query<{ id: string }>("SELECT id FROM schema_migrations ORDER BY id");

    expect(appliedMigrationIds).toEqual([
      "001_initial_review_schema",
      "002_dry_run_published_comments",
      "003_dashboard_auth_retry_state"
    ]);
    expect(secondRunMigrationIds).toEqual([]);
    expect(tables.rows.map((row) => row.table_name)).toEqual(EXPECTED_TABLES);
    expect(applied.rows).toEqual([
      { id: "001_initial_review_schema" },
      { id: "002_dry_run_published_comments" },
      { id: "003_dashboard_auth_retry_state" }
    ]);
  });

  it("stores dry-run comment bodies for dashboard inspection", async () => {
    await runDatabaseMigrations(pool);
    await insertMinimalReviewRun(pool);

    await pool.query(
      `
INSERT INTO published_comments (
  id,
  review_run_id,
  github_comment_id,
  comment_type,
  body,
  body_hash,
  dry_run
) VALUES (
  '00000000-0000-4000-8000-000000000007',
  '00000000-0000-4000-8000-000000000006',
  NULL,
  'summary',
  'Would-be summary body',
  'summary-hash',
  true
)
`
    );

    const comments = await pool.query<{ github_comment_id: string | null; body: string; dry_run: boolean }>(
      "SELECT github_comment_id, body, dry_run FROM published_comments WHERE review_run_id = $1",
      ["00000000-0000-4000-8000-000000000006"]
    );

    expect(comments.rows).toEqual([
      {
        github_comment_id: null,
        body: "Would-be summary body",
        dry_run: true
      }
    ]);
  });

  it("enforces foreign keys and idempotency constraints", async () => {
    await runDatabaseMigrations(pool);

    await expect(
      pool.query(
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
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000009999',
  202,
  'openclaw',
  'firmcode',
  'openclaw/firmcode',
  false,
  'main',
  true
)
`
      )
    ).rejects.toThrow();

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
)
`
    );

    await pool.query(
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
)
`
    );

    await expect(
      pool.query(
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
) VALUES (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001',
  202,
  'openclaw',
  'firmcode-renamed',
  'openclaw/firmcode-renamed',
  false,
  'main',
  true
)
`
      )
    ).rejects.toThrow();

    await pool.query(
      `
INSERT INTO github_deliveries (
  delivery_id,
  event_name,
  action
) VALUES (
  'delivery-1',
  'pull_request',
  'opened'
)
`
    );

    await expect(
      pool.query(
        `
INSERT INTO github_deliveries (
  delivery_id,
  event_name,
  action
) VALUES (
  'delivery-1',
  'pull_request',
  'opened'
)
`
      )
    ).rejects.toThrow();
  });
});

describe("PostgresGitHubWebhookStore repository upserts", () => {
  let pool: PgPoolLike;
  let store: PostgresGitHubWebhookStore;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    store = new PostgresGitHubWebhookStore(pool, createDeterministicUuidFactory());
  });

  afterEach(async () => {
    await pool.end();
  });

  it("upserts installation, repository, and pull request records through database constraints", async () => {
    const installation = await store.upsertInstallation({
      installationId: 101,
      accountLogin: "openclaw",
      accountType: "Organization",
      permissionsJson: { pull_requests: "write" }
    });
    const updatedInstallation = await store.upsertInstallation({
      installationId: 101,
      accountLogin: "openclaw-renamed",
      accountType: "Organization",
      permissionsJson: { pull_requests: "write", contents: "read" }
    });
    const repository = await store.upsertRepository({
      installationId: installation.id,
      githubRepositoryId: 202,
      owner: "openclaw",
      name: "firmcode",
      fullName: "openclaw/firmcode",
      private: true,
      defaultBranch: "main",
      enabled: true
    });
    const updatedRepository = await store.upsertRepository({
      installationId: installation.id,
      githubRepositoryId: 202,
      owner: "openclaw",
      name: "firmcode-renamed",
      fullName: "openclaw/firmcode-renamed",
      private: false,
      defaultBranch: "trunk",
      enabled: false
    });
    const pullRequest = await store.upsertPullRequest({
      repositoryId: repository.id,
      githubPullRequestId: 303,
      number: 7,
      title: "Add migrations",
      authorLogin: "kelly",
      baseRef: "main",
      headRef: "feature/db",
      baseSha: "base-sha",
      headSha: "head-sha-1",
      state: "open",
      draft: false
    });
    const updatedPullRequest = await store.upsertPullRequest({
      repositoryId: repository.id,
      githubPullRequestId: 303,
      number: 7,
      title: "Add database migrations",
      authorLogin: "kelly",
      baseRef: "main",
      headRef: "feature/db",
      baseSha: "base-sha",
      headSha: "head-sha-2",
      state: "open",
      draft: true
    });

    const repositoryCount = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM repositories");
    const pullRequestCount = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM pull_requests");

    expect(updatedInstallation).toMatchObject({
      id: installation.id,
      installationId: 101,
      accountLogin: "openclaw-renamed",
      permissionsJson: { pull_requests: "write", contents: "read" }
    });
    expect(updatedRepository).toMatchObject({
      id: repository.id,
      githubRepositoryId: 202,
      name: "firmcode-renamed",
      fullName: "openclaw/firmcode-renamed",
      private: false,
      defaultBranch: "trunk",
      enabled: false
    });
    expect(updatedPullRequest).toMatchObject({
      id: pullRequest.id,
      repositoryId: repository.id,
      githubPullRequestId: 303,
      number: 7,
      title: "Add database migrations",
      headSha: "head-sha-2",
      draft: true
    });
    expect(repositoryCount.rows[0]).toEqual({ count: "1" });
    expect(pullRequestCount.rows[0]).toEqual({ count: "1" });
  });
});
