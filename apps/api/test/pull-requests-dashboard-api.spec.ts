import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import { PullRequestsController } from "../src/modules/pull-requests/pull-requests.controller";
import { PostgresPullRequestsStore } from "../src/modules/pull-requests/pull-requests.store";
import { PostgresDashboardAuthStore } from "../src/modules/review-runs/dashboard-auth.store";

interface PgPoolLike {
  query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
}

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000101";
const OTHER_WORKSPACE_ID = "00000000-0000-4000-8000-000000000102";
const VIEWER_USER_ID = "user_viewer";
const OTHER_VIEWER_USER_ID = "user_other_viewer";
const PULL_REQUEST_ID = "00000000-0000-4000-8000-000000000301";
const OTHER_PULL_REQUEST_ID = "00000000-0000-4000-8000-000000000303";

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

describe("pull requests dashboard API", () => {
  let pool: PgPoolLike;
  let controller: PullRequestsController;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    await seedPullRequestDashboardData(pool);

    controller = new PullRequestsController(
      new PostgresPullRequestsStore(pool),
      new PostgresDashboardAuthStore(pool)
    );
  });

  afterEach(async () => {
    await pool.end();
  });

  it("lists workspace-scoped pull requests with repository, status, risk, review, author, date, and limit filters", async () => {
    const response = await controller.listPullRequests(
      {
        repository: "openclaw/firmcode",
        status: "open",
        riskLevel: "high",
        reviewStatus: "succeeded",
        author: "kelly",
        dateFrom: "2026-05-22T00:00:00.000Z",
        dateTo: "2026-05-23T00:00:00.000Z",
        limit: "1"
      },
      WORKSPACE_ID,
      VIEWER_USER_ID
    );

    expect(response).toMatchObject({
      filters: {
        repository: "openclaw/firmcode",
        status: "open",
        riskLevel: "high",
        reviewStatus: "succeeded",
        author: "kelly",
        limit: 1
      },
      pagination: {
        limit: 1,
        returned: 1
      }
    });
    expect(response.pullRequests).toEqual([
      expect.objectContaining({
        id: PULL_REQUEST_ID,
        repositoryFullName: "openclaw/firmcode",
        repositoryPrivate: false,
        number: 17,
        title: "Add pull request dashboard",
        authorLogin: "kelly",
        status: "open",
        riskLevel: "high",
        reviewStatus: "succeeded",
        githubUrl: "https://github.com/openclaw/firmcode/pull/17",
        latestReview: expect.objectContaining({
          status: "succeeded",
          findingsCount: 1,
          changedFilesCount: 2,
          durationMs: 180000
        })
      })
    ]);
  });

  it("returns empty results without broadening malformed or unmatched filters", async () => {
    const response = await controller.listPullRequests({ author: "nobody" }, WORKSPACE_ID, VIEWER_USER_ID);

    expect(response.pullRequests).toEqual([]);
    expect(response.pagination).toEqual({
      limit: 50,
      returned: 0
    });
  });

  it("does not expose teammate PRs even when the developer has repository access", async () => {
    await pool.query(
      `INSERT INTO repository_access (repository_id, clerk_user_id, granted_by_clerk_user_id)
       VALUES ('00000000-0000-4000-8000-000000000202', $1, NULL)
       ON CONFLICT (repository_id, clerk_user_id) DO NOTHING`,
      [VIEWER_USER_ID]
    );

    const response = await controller.listPullRequests({ repository: "openclaw/internal" }, WORKSPACE_ID, VIEWER_USER_ID);

    expect(response.pullRequests).toEqual([]);
    await expect(
      controller.getPullRequestDetail("00000000-0000-4000-8000-000000000302", WORKSPACE_ID, VIEWER_USER_ID)
    ).rejects.toThrow(NotFoundException);
  });

  it("applies limit behavior after dashboard risk and review status filters", async () => {
    const response = await controller.listPullRequests({ limit: "1" }, WORKSPACE_ID, VIEWER_USER_ID);

    expect(response.pullRequests).toHaveLength(1);
    expect(response.pullRequests[0]?.updatedAt).toBe("2026-05-22T10:05:00.000Z");
    expect(response.pagination).toEqual({
      limit: 1,
      returned: 1
    });
  });

  it("returns pull request detail with summary, components, risk, timeline, findings, metadata, files, duration, and GitHub link", async () => {
    const detail = await controller.getPullRequestDetail(PULL_REQUEST_ID, WORKSPACE_ID, VIEWER_USER_ID);

    expect(detail).toMatchObject({
      id: PULL_REQUEST_ID,
      repositoryFullName: "openclaw/firmcode",
      number: 17,
      summary: "Firmcode found one high-risk authorization issue.",
      changedComponents: ["apps/api", "infra/docker"],
      riskAnalysis: {
        riskLevel: "high",
        riskFlags: ["auth", "infra"],
        summary: "Touches authorization-sensitive API code and Docker runtime configuration."
      },
      metadata: {
        repositoryId: "00000000-0000-4000-8000-000000000201",
        repositoryFullName: "openclaw/firmcode",
        repositoryPrivate: false,
        reviewRunsCount: 2,
        findingsCount: 1,
        changedFilesCount: 2,
        latestReviewStatus: "succeeded"
      },
      branches: {
        baseRef: "main",
        headRef: "feature/pr-dashboard",
        baseSha: "base-sha",
        headSha: "head-sha-latest"
      },
      commitSha: "head-sha-latest",
      durationMs: 180000,
      githubUrl: "https://github.com/openclaw/firmcode/pull/17"
    });
    expect(detail.reviewTimeline.map((run) => run.status)).toEqual(["succeeded", "failed"]);
    expect(detail.reviewTimeline[0]).toMatchObject({
      currentStage: "Comments Published",
      riskLevel: "high",
      findingsCount: 1
    });
    expect(detail.findings).toEqual([
      expect.objectContaining({
        reviewRunId: "00000000-0000-4000-8000-000000000401",
        source: "semgrep",
        severity: "high",
        postedInline: true
      })
    ]);
    expect(detail.changedFiles.map((file) => file.path)).toEqual([
      "apps/api/src/modules/pull-requests/pull-requests.controller.ts",
      "infra/docker/api.Dockerfile"
    ]);
  });

  it("rejects malformed filters with validation errors", async () => {
    await expect(controller.listPullRequests({ status: "ready" }, WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
    await expect(controller.listPullRequests({ riskLevel: "urgent" }, WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
    await expect(controller.listPullRequests({ reviewStatus: "done" }, WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
    await expect(controller.listPullRequests({ dateFrom: "not-a-date" }, WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
    await expect(
      controller.listPullRequests(
        {
          dateFrom: "2026-05-24T00:00:00.000Z",
          dateTo: "2026-05-23T00:00:00.000Z"
        },
        WORKSPACE_ID,
        VIEWER_USER_ID
      )
    ).rejects.toThrow(BadRequestException);
    await expect(controller.listPullRequests({ limit: "0" }, WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
    await expect(controller.listPullRequests({ repositoryId: "not-a-uuid" }, WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
  });

  it("enforces dashboard authentication, workspace membership, ownership, and missing PR handling", async () => {
    await expect(controller.listPullRequests({}, WORKSPACE_ID, undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.listPullRequests({}, OTHER_WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(NotFoundException);
    await expect(controller.getPullRequestDetail(OTHER_PULL_REQUEST_ID, WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(
      NotFoundException
    );
    await expect(
      controller.getPullRequestDetail("00000000-0000-4000-8000-000000009999", WORKSPACE_ID, VIEWER_USER_ID)
    ).rejects.toThrow(NotFoundException);
  });

  it("does not expose private repository metadata across workspaces", async () => {
    const workspaceResponse = await controller.listPullRequests({}, WORKSPACE_ID, VIEWER_USER_ID);
    const otherWorkspaceResponse = await controller.listPullRequests({}, OTHER_WORKSPACE_ID, OTHER_VIEWER_USER_ID);

    expect(JSON.stringify(workspaceResponse)).not.toContain("other/private-roadmap");
    expect(JSON.stringify(workspaceResponse)).not.toContain("Secret acquisition roadmap");
    expect(otherWorkspaceResponse.pullRequests).toEqual([
      expect.objectContaining({
        id: OTHER_PULL_REQUEST_ID,
        repositoryFullName: "other/private-roadmap",
        repositoryPrivate: true
      })
    ]);
    await expect(controller.getPullRequestDetail(OTHER_PULL_REQUEST_ID, WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(
      "Pull request not found"
    );
  });
});

async function seedPullRequestDashboardData(pool: PgPoolLike): Promise<void> {
  await pool.query(
    `
INSERT INTO workspaces (id, clerk_org_id, name) VALUES
('${WORKSPACE_ID}', 'org_firmcode', 'Firmcode'),
('${OTHER_WORKSPACE_ID}', 'org_other', 'Other');

INSERT INTO user_profiles (id, identity_provider, provider_user_id) VALUES
('${VIEWER_USER_ID}', 'insforge', '${VIEWER_USER_ID}'),
('${OTHER_VIEWER_USER_ID}', 'insforge', '${OTHER_VIEWER_USER_ID}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_memberships (workspace_id, clerk_user_id, user_id, role, active) VALUES
('${WORKSPACE_ID}', '${VIEWER_USER_ID}', '${VIEWER_USER_ID}', 'developer', true),
('${OTHER_WORKSPACE_ID}', '${OTHER_VIEWER_USER_ID}', '${OTHER_VIEWER_USER_ID}', 'developer', true);

INSERT INTO github_oauth_connections (clerk_user_id, github_user_id, github_login, scopes_json) VALUES
('${VIEWER_USER_ID}', 701, 'kelly', '[]'),
('${OTHER_VIEWER_USER_ID}', 702, 'mallory', '[]');

INSERT INTO github_installations (
  id,
  workspace_id,
  installation_id,
  account_login,
  permissions_json
) VALUES
(
  '00000000-0000-4000-8000-000000000111',
  '${WORKSPACE_ID}',
  111,
  'openclaw',
  '{"pull_requests":"write"}'
),
(
  '00000000-0000-4000-8000-000000000112',
  '${OTHER_WORKSPACE_ID}',
  112,
  'other',
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
  '00000000-0000-4000-8000-000000000111',
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
  '00000000-0000-4000-8000-000000000111',
  202,
  'openclaw',
  'internal',
  'openclaw/internal',
  true,
  'main',
  true
),
(
  '00000000-0000-4000-8000-000000000203',
  '00000000-0000-4000-8000-000000000112',
  203,
  'other',
  'private-roadmap',
  'other/private-roadmap',
  true,
  'main',
  true
);

INSERT INTO repository_access (repository_id, clerk_user_id, granted_by_clerk_user_id) VALUES
('00000000-0000-4000-8000-000000000201', '${VIEWER_USER_ID}', NULL),
('00000000-0000-4000-8000-000000000203', '${OTHER_VIEWER_USER_ID}', NULL);

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
  draft,
  created_at,
  updated_at
) VALUES
(
  '${PULL_REQUEST_ID}',
  '00000000-0000-4000-8000-000000000201',
  301,
  17,
  'Add pull request dashboard',
  'kelly',
  'main',
  'feature/pr-dashboard',
  'base-sha',
  'head-sha-latest',
  'open',
  false,
  '2026-05-22T09:55:00.000Z',
  '2026-05-22T10:05:00.000Z'
),
(
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000202',
  302,
  18,
  'Fix internal dashboard copy',
  'octocat',
  'main',
  'feature/internal-copy',
  'base-sha',
  'head-sha-copy',
  'open',
  true,
  '2026-05-21T09:55:00.000Z',
  '2026-05-21T10:05:00.000Z'
),
(
  '${OTHER_PULL_REQUEST_ID}',
  '00000000-0000-4000-8000-000000000203',
  303,
  99,
  'Secret acquisition roadmap',
  'mallory',
  'main',
  'feature/private-roadmap',
  'base-sha',
  'head-sha-secret',
  'open',
  false,
  '2026-05-22T08:00:00.000Z',
  '2026-05-22T08:05:00.000Z'
);

INSERT INTO github_deliveries (delivery_id, event_name, action) VALUES
('delivery-pr-latest', 'pull_request', 'synchronize'),
('delivery-pr-older', 'pull_request', 'opened'),
('delivery-internal', 'pull_request', 'opened'),
('delivery-other-private', 'pull_request', 'opened');

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
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000201',
  '${PULL_REQUEST_ID}',
  'delivery-pr-latest',
  'pull_request.synchronize',
  'head-sha-latest',
  'succeeded',
  '2026-05-22T10:00:00.000Z',
  '2026-05-22T10:03:00.000Z',
  '{"riskLevel":"high","durationMs":180000,"currentStage":"Comments Published","changedComponents":["apps/api","infra/docker"],"riskAnalysis":"Touches authorization-sensitive API code and Docker runtime configuration."}',
  '2026-05-22T10:00:00.000Z',
  '2026-05-22T10:03:00.000Z'
),
(
  '00000000-0000-4000-8000-000000000402',
  '00000000-0000-4000-8000-000000000201',
  '${PULL_REQUEST_ID}',
  'delivery-pr-older',
  'pull_request.opened',
  'head-sha-old',
  'failed',
  '2026-05-22T09:00:00.000Z',
  '2026-05-22T09:02:00.000Z',
  '{"riskLevel":"medium","durationMs":120000,"currentStage":"Semgrep Scanned"}',
  '2026-05-22T09:00:00.000Z',
  '2026-05-22T09:02:00.000Z'
),
(
  '00000000-0000-4000-8000-000000000403',
  '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000302',
  'delivery-internal',
  'pull_request.opened',
  'head-sha-copy',
  'queued',
  NULL,
  NULL,
  '{}',
  '2026-05-21T10:00:00.000Z',
  '2026-05-21T10:00:00.000Z'
),
(
  '00000000-0000-4000-8000-000000000404',
  '00000000-0000-4000-8000-000000000203',
  '${OTHER_PULL_REQUEST_ID}',
  'delivery-other-private',
  'pull_request.opened',
  'head-sha-secret',
  'failed',
  '2026-05-22T08:00:00.000Z',
  '2026-05-22T08:01:00.000Z',
  '{"riskLevel":"high","durationMs":60000}',
  '2026-05-22T08:00:00.000Z',
  '2026-05-22T08:01:00.000Z'
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
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000401',
  'apps/api/src/modules/pull-requests/pull-requests.controller.ts',
  'added',
  110,
  0,
  'TypeScript',
  false,
  true,
  '["auth"]'
),
(
  '00000000-0000-4000-8000-000000000502',
  '00000000-0000-4000-8000-000000000401',
  'infra/docker/api.Dockerfile',
  'modified',
  8,
  2,
  'Dockerfile',
  true,
  true,
  '["infra"]'
),
(
  '00000000-0000-4000-8000-000000000503',
  '00000000-0000-4000-8000-000000000402',
  'apps/api/src/modules/old.ts',
  'modified',
  2,
  1,
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
  '00000000-0000-4000-8000-000000000601',
  '00000000-0000-4000-8000-000000000401',
  'semgrep',
  'security',
  'high',
  'high',
  'apps/api/src/modules/pull-requests/pull-requests.controller.ts',
  42,
  42,
  'Scope pull request reads',
  'Pull request dashboard data must be workspace scoped.',
  '[{"source":"semgrep","ruleId":"firmcode.workspace.scope","excerpt":"workspace_id"}]',
  'Join through installation workspace ownership.',
  'pr-dashboard-1',
  true,
  '2026-05-22T10:01:00.000Z'
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
  '00000000-0000-4000-8000-000000000701',
  '00000000-0000-4000-8000-000000000401',
  NULL,
  9001,
  NULL,
  'summary',
  NULL,
  NULL,
  'Firmcode found one high-risk authorization issue.',
  'summary-hash',
  false,
  '2026-05-22T10:02:00.000Z'
),
(
  '00000000-0000-4000-8000-000000000702',
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000601',
  9002,
  9003,
  'inline',
  'apps/api/src/modules/pull-requests/pull-requests.controller.ts',
  42,
  'Inline body',
  'inline-hash',
  false,
  '2026-05-22T10:02:30.000Z'
);
`
  );
}
