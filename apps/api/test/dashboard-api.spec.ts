import { BadRequestException, NotFoundException } from "@nestjs/common";
import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import { RepositoriesController } from "../src/modules/repositories/repositories.controller";
import { PostgresRepositoriesStore } from "../src/modules/repositories/repositories.store";
import { FindingsController } from "../src/modules/review-runs/findings.controller";
import { PostgresFindingsStore } from "../src/modules/review-runs/findings.store";
import { PostgresDashboardAuthStore } from "../src/modules/review-runs/dashboard-auth.store";
import { ReviewRunsController } from "../src/modules/review-runs/review-runs.controller";
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

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000101";
const DEVELOPER_USER_ID = "user_developer";
const VIEWER_USER_ID = "user_viewer";

describe("dashboard API controllers", () => {
  let pool: PgPoolLike;
  let repositoriesController: RepositoriesController;
  let findingsController: FindingsController;
  let reviewRunsController: ReviewRunsController;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    await seedDashboardData(pool);
    repositoriesController = new RepositoriesController(new PostgresRepositoriesStore(pool));
    findingsController = new FindingsController(new PostgresFindingsStore(pool));
    reviewRunsController = new ReviewRunsController(
      new PostgresReviewRunsStore(pool),
      new PostgresDashboardAuthStore(pool)
    );
  });

  afterEach(async () => {
    await pool.end();
  });

  it("lists repositories with enabled status, findings, and last review", async () => {
    const response = await repositoriesController.listRepositories({});

    expect(response.repositories).toHaveLength(2);
    expect(response.repositories[0]).toMatchObject({
      fullName: "openclaw/firmcode",
      enabled: true,
      private: false,
      primaryLanguage: "TypeScript",
      openFindingsCount: 2,
      lastReview: {
        pullRequestNumber: 7,
        pullRequestTitle: "Add repository dashboard",
        status: "succeeded",
        headSha: "abc123def456"
      }
    });
  });

  it("filters repositories by automation, visibility, and language", async () => {
    const response = await repositoriesController.listRepositories({
      enabled: "true",
      private: "false",
      language: "typescript"
    });

    expect(response.repositories.map((repository) => repository.fullName)).toEqual(["openclaw/firmcode"]);
  });

  it("lists review runs with status, repository, and date filters", async () => {
    const response = await reviewRunsController.listReviewRuns({
      status: "succeeded",
      repository: "openclaw/firmcode",
      dateFrom: "2026-05-22T00:00:00.000Z",
      dateTo: "2026-05-23T00:00:00.000Z"
    });

    expect(response.reviewRuns).toHaveLength(1);
    expect(response.reviewRuns[0]).toMatchObject({
      id: "00000000-0000-4000-8000-000000000006",
      repositoryFullName: "openclaw/firmcode",
      status: "succeeded",
      currentStage: "Comments Published",
      findingsCount: 2,
      commentsPostedCount: 1,
      filesAnalyzedCount: 2,
      riskLevel: "high"
    });
  });

  it("returns review run detail with files, findings, artifacts, logs, and published comments", async () => {
    const detail = await reviewRunsController.getReviewRunDetail(
      "00000000-0000-4000-8000-000000000006",
      WORKSPACE_ID,
      DEVELOPER_USER_ID
    );

    expect(detail).toMatchObject({
      repositoryFullName: "openclaw/firmcode",
      pullRequestNumber: 7,
      pullRequestTitle: "Add repository dashboard",
      status: "succeeded",
      durationMs: 120000,
      filesAnalyzedCount: 2,
      semgrepFindingsCount: 1,
      aiFindingsCount: 1,
      inlineCommentsPostedCount: 1,
      tokenUsage: 1800,
      estimatedCostUsd: 0.12,
      changedFiles: [
        {
          path: "apps/web/app/repositories/page.tsx",
          language: "TypeScript",
          riskFlags: ["auth"]
        },
        {
          path: "apps/web/components/dashboard/repositories-view.tsx",
          language: "TypeScript",
          riskFlags: []
        }
      ],
      findings: [
        {
          source: "semgrep",
          severity: "high",
          postedInline: true
        },
        {
          source: "llm",
          severity: "medium",
          postedInline: false
        }
      ],
      artifacts: [
        {
          artifactType: "ci_log",
          storageKey: "artifacts/run-6/ci-log.json",
          rawAccessAllowed: true
        },
        {
          artifactType: "diff",
          storageKey: "artifacts/run-6/diff.json"
        },
        {
          artifactType: "semgrep",
          storageKey: "artifacts/run-6/semgrep.json"
        }
      ],
      logExcerpts: [
        {
          title: "unit tests",
          excerpt: "PASS apps/web tests",
          redacted: true
        }
      ],
      publishedComments: [
        {
          commentType: "summary",
          body: "Summary body"
        },
        {
          commentType: "inline",
          filePath: "apps/web/app/repositories/page.tsx",
          line: 42,
          body: "Inline body"
        }
      ],
      permissions: {
        canAccessRawArtifacts: true,
        canRetryReviewRun: true
      }
    });
  });

  it("redacts raw artifact locators for viewers and denies raw artifact access", async () => {
    const detail = await reviewRunsController.getReviewRunDetail(
      "00000000-0000-4000-8000-000000000006",
      WORKSPACE_ID,
      VIEWER_USER_ID
    );

    expect(detail.artifacts[0]).toMatchObject({
      artifactType: "ci_log",
      storageKey: null,
      rawAccessAllowed: false,
      rawAccessUrl: null
    });
    expect(detail.logExcerpts[0]?.storageKey).toBeNull();
    await expect(
      reviewRunsController.getRawArtifactAccess(
        "00000000-0000-4000-8000-000000000006",
        "00000000-0000-4000-8000-000000000040",
        WORKSPACE_ID,
        VIEWER_USER_ID
      )
    ).rejects.toMatchObject({ status: 403 });
  });

  it("allows developer and elevated roles to request raw artifact access metadata", async () => {
    const artifact = await reviewRunsController.getRawArtifactAccess(
      "00000000-0000-4000-8000-000000000006",
      "00000000-0000-4000-8000-000000000041",
      WORKSPACE_ID,
      DEVELOPER_USER_ID
    );

    expect(artifact).toMatchObject({
      reviewRunId: "00000000-0000-4000-8000-000000000006",
      artifactId: "00000000-0000-4000-8000-000000000041",
      artifactType: "diff",
      storageKey: "artifacts/run-6/diff.json",
      rawAccessAllowed: true
    });
  });

  it("lists findings with filterable inbox metadata and GitHub comment links", async () => {
    const response = await findingsController.listFindings({
      severity: "high",
      source: "semgrep",
      category: "security",
      repository: "openclaw/firmcode",
      status: "posted",
      postedInline: "true",
      dateFrom: "2026-05-22T00:00:00.000Z",
      dateTo: "2026-05-23T00:00:00.000Z"
    });

    expect(response.findings).toHaveLength(1);
    expect(response.findings[0]).toMatchObject({
      id: "00000000-0000-4000-8000-000000000030",
      reviewRunId: "00000000-0000-4000-8000-000000000006",
      repositoryFullName: "openclaw/firmcode",
      pullRequestNumber: 7,
      status: "posted",
      postedInline: true,
      semgrepRuleId: "typescript.express.security.audit.workspace-scope",
      githubCommentId: 8002,
      githubCommentUrl: "https://github.com/openclaw/firmcode/pull/7#discussion_r8002"
    });
  });

  it("filters open and unsupported future finding statuses", async () => {
    const openResponse = await findingsController.listFindings({ status: "open", postedInline: "false" });
    const resolvedResponse = await findingsController.listFindings({ status: "resolved" });

    expect(openResponse.findings.map((finding) => finding.title)).toEqual(["Keep filters stable"]);
    expect(resolvedResponse.findings).toEqual([]);
  });

  it("rejects invalid filters and missing review run details", async () => {
    await expect(reviewRunsController.listReviewRuns({ status: "done" })).rejects.toThrow(BadRequestException);
    await expect(findingsController.listFindings({ severity: "urgent" })).rejects.toThrow(BadRequestException);
    await expect(findingsController.listFindings({ postedInline: "sometimes" })).rejects.toThrow(BadRequestException);
    await expect(
      reviewRunsController.getReviewRunDetail("00000000-0000-4000-8000-000000999999", WORKSPACE_ID, DEVELOPER_USER_ID)
    ).rejects.toThrow(NotFoundException);
  });
});

async function seedDashboardData(pool: PgPoolLike): Promise<void> {
  await pool.query(
    `
INSERT INTO workspaces (id, clerk_org_id, name) VALUES
('${WORKSPACE_ID}', 'org_firmcode', 'Firmcode');

INSERT INTO workspace_memberships (workspace_id, clerk_user_id, role, active) VALUES
('${WORKSPACE_ID}', '${DEVELOPER_USER_ID}', 'developer', true),
('${WORKSPACE_ID}', '${VIEWER_USER_ID}', 'viewer', true);

INSERT INTO github_installations (
  id,
  workspace_id,
  installation_id,
  permissions_json
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  '${WORKSPACE_ID}',
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
) VALUES
(
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  202,
  'openclaw',
  'firmcode',
  'openclaw/firmcode',
  false,
  'main',
  true
),
(
  '00000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000001',
  212,
  'openclaw',
  'legacy',
  'openclaw/legacy',
  true,
  'main',
  false
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
) VALUES
(
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  303,
  7,
  'Add repository dashboard',
  'kelly',
  'main',
  'feature/dashboard',
  'base-sha',
  'abc123def456',
  'open',
  false
),
(
  '00000000-0000-4000-8000-000000000013',
  '00000000-0000-4000-8000-000000000012',
  313,
  9,
  'Fix legacy smoke test',
  'octocat',
  'main',
  'feature/legacy',
  'base-sha',
  'fed456cba123',
  'open',
  false
);

INSERT INTO github_deliveries (
  delivery_id,
  event_name,
  action
) VALUES
('delivery-dashboard', 'pull_request', 'opened'),
('delivery-legacy', 'pull_request', 'synchronize');

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
  metrics_json,
  created_at,
  updated_at
) VALUES
(
  '00000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  'delivery-dashboard',
  'pull_request.opened',
  'abc123def456',
  'succeeded',
  '2026-05-22T10:00:00.000Z',
  '2026-05-22T10:02:00.000Z',
  '{"riskLevel":"high","durationMs":120000,"tokenUsage":1800,"estimatedCostUsd":0.12,"currentStage":"Comments Published","pipelineStages":[{"key":"webhook_received","label":"Webhook Received","status":"succeeded","durationMs":100,"errorMessage":null,"artifactId":null},{"key":"comments_published","label":"Comments Published","status":"succeeded","durationMs":900,"errorMessage":null,"artifactId":null}]}',
  '2026-05-22T10:00:00.000Z',
  '2026-05-22T10:02:00.000Z'
),
(
  '00000000-0000-4000-8000-000000000016',
  '00000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000013',
  'delivery-legacy',
  'pull_request.synchronize',
  'fed456cba123',
  'failed',
  '2026-05-21T10:00:00.000Z',
  '2026-05-21T10:01:00.000Z',
  '{"riskLevel":"medium","durationMs":60000,"currentStage":"Semgrep Scanned"}',
  '2026-05-21T10:00:00.000Z',
  '2026-05-21T10:01:00.000Z'
);

INSERT INTO changed_files (
  id,
  review_run_id,
  path,
  status,
  additions,
  deletions,
  language,
  is_infrastructure,
  is_supported,
  risk_flags_json
) VALUES
(
  '00000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000006',
  'apps/web/app/repositories/page.tsx',
  'added',
  42,
  0,
  'TypeScript',
  false,
  true,
  '["auth"]'
),
(
  '00000000-0000-4000-8000-000000000021',
  '00000000-0000-4000-8000-000000000006',
  'apps/web/components/dashboard/repositories-view.tsx',
  'added',
  120,
  0,
  'TypeScript',
  false,
  true,
  '[]'
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
  evidence_json,
  suggestion,
  dedupe_key,
  post_as_inline,
  created_at
) VALUES
(
  '00000000-0000-4000-8000-000000000030',
  '00000000-0000-4000-8000-000000000006',
  'semgrep',
  'security',
  'high',
  'high',
  'apps/web/app/repositories/page.tsx',
  42,
  42,
  'Guard repository access',
  'Repository access must be workspace scoped.',
  '[{"source":"semgrep","ruleId":"typescript.express.security.audit.workspace-scope","excerpt":"repositoryId"}]',
  'Check workspace ownership before returning repository rows.',
  'finding-dashboard-1',
  true,
  '2026-05-22T10:00:30.000Z'
),
(
  '00000000-0000-4000-8000-000000000031',
  '00000000-0000-4000-8000-000000000006',
  'llm',
  'maintainability',
  'medium',
  'medium',
  'apps/web/components/dashboard/repositories-view.tsx',
  75,
  75,
  'Keep filters stable',
  'The dashboard should retain active filters.',
  '[{"source":"llm","excerpt":"filter form"}]',
  NULL,
  'finding-dashboard-2',
  false,
  '2026-05-22T10:01:00.000Z'
);

INSERT INTO analysis_artifacts (
  id,
  review_run_id,
  artifact_type,
  storage_key,
  metadata_json
) VALUES
(
  '00000000-0000-4000-8000-000000000040',
  '00000000-0000-4000-8000-000000000006',
  'ci_log',
  'artifacts/run-6/ci-log.json',
  '{"logs":[{"name":"unit tests","excerpt":"PASS apps/web tests","redacted":true,"truncated":false}]}'
),
(
  '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000006',
  'diff',
  'artifacts/run-6/diff.json',
  '{"files":2}'
),
(
  '00000000-0000-4000-8000-000000000042',
  '00000000-0000-4000-8000-000000000006',
  'semgrep',
  'artifacts/run-6/semgrep.json',
  '{"findings":1}'
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
  dry_run,
  created_at
) VALUES
(
  '00000000-0000-4000-8000-000000000050',
  '00000000-0000-4000-8000-000000000006',
  NULL,
  8001,
  NULL,
  'summary',
  NULL,
  NULL,
  'Summary body',
  'summary-body-hash',
  false,
  '2026-05-22T10:01:30.000Z'
),
(
  '00000000-0000-4000-8000-000000000051',
  '00000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000030',
  8002,
  9001,
  'inline',
  'apps/web/app/repositories/page.tsx',
  42,
  'Inline body',
  'inline-body-hash',
  false,
  '2026-05-22T10:01:45.000Z'
);
`
  );
}
