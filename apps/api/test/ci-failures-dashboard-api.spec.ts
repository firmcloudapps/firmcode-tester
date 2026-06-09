import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import { CiFailuresController } from "../src/modules/ci-failures/ci-failures.controller";
import { PostgresCiFailuresStore } from "../src/modules/ci-failures/ci-failures.store";
import { PostgresDashboardAuthStore } from "../src/modules/review-runs/dashboard-auth.store";
import { ReviewRunsController } from "../src/modules/review-runs/review-runs.controller";
import { PostgresReviewRunsStore } from "../src/modules/review-runs/review-runs.store";

interface PgPoolLike {
  query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
}

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000101";
const OTHER_WORKSPACE_ID = "00000000-0000-4000-8000-000000000102";
const ADMIN_USER_ID = "user_admin";
const DEVELOPER_USER_ID = "user_developer";
const VIEWER_USER_ID = "user_viewer";
const OTHER_VIEWER_USER_ID = "user_other_viewer";
const EXPLANATION_ARTIFACT_ID = "00000000-0000-4000-8000-000000000501";
const CI_LOG_ARTIFACT_ID = "00000000-0000-4000-8000-000000000502";
const FLAKY_EXPLANATION_ARTIFACT_ID = "00000000-0000-4000-8000-000000000503";
const OTHER_EXPLANATION_ARTIFACT_ID = "00000000-0000-4000-8000-000000000504";
const CI_FAILURE_ID = `${EXPLANATION_ARTIFACT_ID}:ci%3A101%3Anpm-test%3Aabc123def456`;
const OTHER_CI_FAILURE_ID = `${OTHER_EXPLANATION_ARTIFACT_ID}:ci%3A303%3Adeploy%3Aprivate`;
const RAW_SECRET = "RAW_TOKEN=super-secret-value";

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

describe("CI failures dashboard API", () => {
  let pool: PgPoolLike;
  let controller: CiFailuresController;
  let reviewRunsController: ReviewRunsController;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    await seedCiFailureDashboardData(pool);

    const dashboardAuthStore = new PostgresDashboardAuthStore(pool);
    controller = new CiFailuresController(new PostgresCiFailuresStore(pool), dashboardAuthStore);
    reviewRunsController = new ReviewRunsController(new PostgresReviewRunsStore(pool), dashboardAuthStore);
  });

  afterEach(async () => {
    await pool.end();
  });

  it("lists workspace-scoped CI failures with repository, PR, failed job, root cause, flaky status, suggested fix, status, and created time", async () => {
    const response = await controller.listCiFailures(
      {
        repository: "openclaw/firmcode",
        status: "succeeded",
        flaky: "false",
        dateFrom: "2026-05-22T00:00:00.000Z",
        dateTo: "2026-05-24T00:00:00.000Z",
        limit: "1"
      },
      WORKSPACE_ID,
      VIEWER_USER_ID
    );

    expect(response).toMatchObject({
      filters: {
        repository: "openclaw/firmcode",
        status: "succeeded",
        flaky: false,
        limit: 1
      },
      pagination: {
        limit: 1,
        returned: 1
      }
    });
    expect(response.ciFailures).toEqual([
      expect.objectContaining({
        id: CI_FAILURE_ID,
        repositoryFullName: "openclaw/firmcode",
        pullRequestNumber: 77,
        pullRequestTitle: "Fix payment tests",
        reviewRunId: "00000000-0000-4000-8000-000000000401",
        failedJob: expect.objectContaining({
          jobName: "unit tests",
          checkRunId: 101,
          stepName: "npm test",
          detailsUrl: "https://github.com/openclaw/firmcode/actions/runs/202/jobs/303"
        }),
        rootCauseSummary:
          "The unit tests job failed in step `npm test` because the log reports: AssertionError: expected 201 to equal 200.",
        flakySuspected: false,
        suggestedFix: "Reproduce the failing test command locally: `npm test`.",
        status: "succeeded",
        createdAt: "2026-05-23T10:06:00.000Z"
      })
    ]);
    expect(JSON.stringify(response)).not.toContain(RAW_SECRET);
  });

  it("filters flaky CI failures independently from SQL-backed filters", async () => {
    const response = await controller.listCiFailures({ flaky: "true" }, WORKSPACE_ID, VIEWER_USER_ID);

    expect(response.ciFailures).toHaveLength(1);
    expect(response.ciFailures[0]).toMatchObject({
      id: `${FLAKY_EXPLANATION_ARTIFACT_ID}:ci%3A202%3Apytest%3Aflaky`,
      flakySuspected: true,
      suggestedFix: "Rerun the failed job once; if it passes, harden or quarantine the unstable test instead of masking it."
    });
  });

  it("returns CI failure detail with suggested fixes, failed jobs, related links, and collapsed redacted log excerpts", async () => {
    const detail = await controller.getCiFailureDetail(CI_FAILURE_ID, WORKSPACE_ID, VIEWER_USER_ID);

    expect(detail).toMatchObject({
      id: CI_FAILURE_ID,
      rootCause:
        "The unit tests job failed in step `npm test` because the log reports: AssertionError: expected 201 to equal 200.",
      suggestedFixes: [
        {
          id: `${CI_FAILURE_ID}:fix:1`,
          text: "Reproduce the failing test command locally: `npm test`."
        },
        {
          id: `${CI_FAILURE_ID}:fix:2`,
          text: "Inspect the failing assertion and update either the changed behavior or the expected value."
        }
      ],
      failedJobs: [
        {
          jobName: "unit tests",
          checkRunId: 101,
          conclusion: "failure",
          category: "test_failure"
        }
      ],
      relatedReviewRun: {
        id: "00000000-0000-4000-8000-000000000401",
        status: "succeeded",
        detailUrl: "/api/review-runs/00000000-0000-4000-8000-000000000401"
      },
      relatedArtifacts: [
        {
          artifactType: "ci_failure_explanation",
          storageKey: null,
          rawAccessAllowed: false,
          rawAccessUrl: null
        },
        {
          artifactType: "ci_log",
          storageKey: null,
          rawAccessAllowed: false,
          rawAccessUrl: null
        }
      ],
      logExcerpts: [
        {
          excerpt: "FAIL src/payments.test.ts\nAssertionError: expected 201 to equal 200\nTOKEN=[REDACTED_SECRET]",
          redacted: true,
          collapsed: true,
          storageKey: null,
          artifactId: CI_LOG_ARTIFACT_ID
        }
      ]
    });
    expect(JSON.stringify(detail)).not.toContain(RAW_SECRET);
  });

  it("keeps raw logs out of default detail responses even for raw-artifact-capable roles", async () => {
    const detail = await controller.getCiFailureDetail(CI_FAILURE_ID, WORKSPACE_ID, ADMIN_USER_ID);

    expect(detail.relatedArtifacts.find((artifact) => artifact.artifactType === "ci_log")).toMatchObject({
      storageKey: "artifacts/run-401/ci-log.json",
      rawAccessAllowed: true,
      rawAccessUrl: `/api/review-runs/00000000-0000-4000-8000-000000000401/artifacts/${CI_LOG_ARTIFACT_ID}/raw`
    });
    expect(JSON.stringify(detail)).not.toContain(RAW_SECRET);
    expect(JSON.stringify(detail)).toContain("[REDACTED_SECRET]");
  });

  it("denies raw CI log artifact metadata to non-elevated roles through the raw artifact endpoint", async () => {
    await expect(
      reviewRunsController.getRawArtifactAccess(
        "00000000-0000-4000-8000-000000000401",
        CI_LOG_ARTIFACT_ID,
        WORKSPACE_ID,
        VIEWER_USER_ID
      )
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects missing failures, malformed filters, and malformed IDs", async () => {
    await expect(
      controller.getCiFailureDetail(
        "00000000-0000-4000-8000-000000009999:ci%3Amissing",
        WORKSPACE_ID,
        VIEWER_USER_ID
      )
    ).rejects.toThrow(NotFoundException);
    await expect(controller.getCiFailureDetail("not-a-ci-failure-id", WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
    await expect(controller.listCiFailures({ status: "done" }, WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
    await expect(controller.listCiFailures({ flaky: "sometimes" }, WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
    await expect(controller.listCiFailures({ dateFrom: "not-a-date" }, WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
    await expect(
      controller.listCiFailures(
        {
          dateFrom: "2026-05-24T00:00:00.000Z",
          dateTo: "2026-05-23T00:00:00.000Z"
        },
        WORKSPACE_ID,
        VIEWER_USER_ID
      )
    ).rejects.toThrow(BadRequestException);
    await expect(controller.listCiFailures({ limit: "101" }, WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
    await expect(controller.listCiFailures({ repositoryId: "not-a-uuid" }, WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
  });

  it("enforces dashboard authentication, ownership, and cross-workspace isolation", async () => {
    await expect(controller.listCiFailures({}, WORKSPACE_ID, undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.listCiFailures({}, OTHER_WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(NotFoundException);
    await expect(controller.getCiFailureDetail(OTHER_CI_FAILURE_ID, WORKSPACE_ID, VIEWER_USER_ID)).rejects.toThrow(
      NotFoundException
    );

    const otherWorkspaceResponse = await controller.listCiFailures({}, OTHER_WORKSPACE_ID, OTHER_VIEWER_USER_ID);
    const workspaceResponse = await controller.listCiFailures({}, WORKSPACE_ID, VIEWER_USER_ID);

    expect(otherWorkspaceResponse.ciFailures).toEqual([
      expect.objectContaining({
        id: OTHER_CI_FAILURE_ID,
        repositoryFullName: "other/private-roadmap"
      })
    ]);
    expect(JSON.stringify(workspaceResponse)).not.toContain("other/private-roadmap");
    expect(JSON.stringify(workspaceResponse)).not.toContain("Deploy private roadmap");
  });
});

async function seedCiFailureDashboardData(pool: PgPoolLike): Promise<void> {
  const ciExplanation = {
    schemaVersion: "ci-failure-explanation/v1",
    reviewRunId: "00000000-0000-4000-8000-000000000401",
    repositoryFullName: "openclaw/firmcode",
    pullRequestNumber: 77,
    headSha: "head-sha-ci",
    summary:
      "Found 1 CI failure group across 1 failed job. Most likely: The unit tests job failed in step `npm test` because the log reports: AssertionError: expected 201 to equal 200.",
    groups: [
      {
        id: "ci:101:npm-test:abc123def456",
        jobName: "unit tests",
        checkRunId: 101,
        conclusion: "failure",
        stepName: "npm test",
        category: "test_failure",
        rootCauseSummary:
          "The unit tests job failed in step `npm test` because the log reports: AssertionError: expected 201 to equal 200.",
        suggestedFixes: [
          "Reproduce the failing test command locally: `npm test`.",
          "Inspect the failing assertion and update either the changed behavior or the expected value."
        ],
        flaky: false,
        flakySignals: [],
        evidence: [
          {
            checkRunId: 101,
            workflowJobId: 303,
            stepName: "npm test",
            excerpt: "FAIL src/payments.test.ts\nAssertionError: expected 201 to equal 200\nTOKEN=[REDACTED_SECRET]"
          }
        ]
      }
    ],
    unavailableLogNotes: []
  };
  const flakyExplanation = {
    schemaVersion: "ci-failure-explanation/v1",
    reviewRunId: "00000000-0000-4000-8000-000000000402",
    repositoryFullName: "openclaw/firmcode",
    pullRequestNumber: 78,
    headSha: "head-sha-flaky",
    summary: "Found 1 CI failure group across 1 failed job. Most likely: an integration timeout may be flaky.",
    groups: [
      {
        id: "ci:202:pytest:flaky",
        jobName: "integration tests",
        checkRunId: 202,
        conclusion: "timed_out",
        stepName: "pytest apps/api/tests",
        category: "timeout",
        rootCauseSummary: "The integration tests job timed out waiting for a service health check.",
        suggestedFixes: [
          "Rerun the failed job once; if it passes, harden or quarantine the unstable test instead of masking it."
        ],
        flaky: true,
        flakySignals: [{ signal: "explicit_flaky", detail: "The same test passed on retry.", confidence: 0.8 }],
        evidence: [
          {
            checkRunId: 202,
            workflowJobId: 404,
            stepName: "pytest apps/api/tests",
            excerpt: "TimeoutError: waited 60000ms for http://localhost:5432/health"
          }
        ]
      }
    ],
    unavailableLogNotes: []
  };
  const otherExplanation = {
    schemaVersion: "ci-failure-explanation/v1",
    reviewRunId: "00000000-0000-4000-8000-000000000403",
    repositoryFullName: "other/private-roadmap",
    pullRequestNumber: 99,
    headSha: "head-sha-private",
    summary: "Deploy private roadmap failed.",
    groups: [
      {
        id: "ci:303:deploy:private",
        jobName: "Deploy private roadmap",
        checkRunId: 303,
        conclusion: "failure",
        stepName: "deploy",
        category: "infrastructure",
        rootCauseSummary: "Deploy private roadmap failed.",
        suggestedFixes: ["Check the private deployment credentials."],
        flaky: false,
        flakySignals: [],
        evidence: [{ checkRunId: 303, workflowJobId: 505, stepName: "deploy", excerpt: "Deployment failed." }]
      }
    ],
    unavailableLogNotes: []
  };
  const ciLogArtifact = {
    schemaVersion: "ci-log-artifact/v1",
    reviewRunId: "00000000-0000-4000-8000-000000000401",
    repositoryFullName: "openclaw/firmcode",
    pullRequestNumber: 77,
    headSha: "head-sha-ci",
    checkRuns: [
      {
        id: 101,
        name: "unit tests",
        status: "completed",
        conclusion: "failure",
        appSlug: "github-actions",
        detailsUrl: "https://github.com/openclaw/firmcode/actions/runs/202/jobs/303",
        htmlUrl: "https://github.com/openclaw/firmcode/actions/runs/202/job/303",
        workflowRunId: 202,
        workflowJobId: 303,
        startedAt: "2026-05-23T10:00:00Z",
        completedAt: "2026-05-23T10:05:00Z"
      }
    ],
    logs: [
      {
        checkRunId: 101,
        name: "unit tests",
        source: "github_actions_job",
        workflowRunId: 202,
        workflowJobId: 303,
        content: `${RAW_SECRET}\nFAIL src/payments.test.ts\nAssertionError: expected 201 to equal 200`,
        originalBytes: 91,
        redactedBytes: 72,
        storedBytes: 72,
        truncated: false,
        redacted: true
      }
    ],
    unavailableLogs: []
  };

  await pool.query(
    `
INSERT INTO workspaces (id, clerk_org_id, name) VALUES
('${WORKSPACE_ID}', 'org_firmcode', 'Firmcode'),
('${OTHER_WORKSPACE_ID}', 'org_other', 'Other');

INSERT INTO user_profiles (id, identity_provider, provider_user_id) VALUES
('${ADMIN_USER_ID}', 'insforge', '${ADMIN_USER_ID}'),
('${DEVELOPER_USER_ID}', 'insforge', '${DEVELOPER_USER_ID}'),
('${VIEWER_USER_ID}', 'insforge', '${VIEWER_USER_ID}'),
('${OTHER_VIEWER_USER_ID}', 'insforge', '${OTHER_VIEWER_USER_ID}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_memberships (workspace_id, clerk_user_id, user_id, role, active) VALUES
('${WORKSPACE_ID}', '${ADMIN_USER_ID}', '${ADMIN_USER_ID}', 'admin', true),
('${WORKSPACE_ID}', '${DEVELOPER_USER_ID}', '${DEVELOPER_USER_ID}', 'developer', true),
('${WORKSPACE_ID}', '${VIEWER_USER_ID}', '${VIEWER_USER_ID}', 'developer', true),
('${OTHER_WORKSPACE_ID}', '${OTHER_VIEWER_USER_ID}', '${OTHER_VIEWER_USER_ID}', 'developer', true);

INSERT INTO github_oauth_connections (clerk_user_id, github_user_id, github_login, scopes_json) VALUES
('${DEVELOPER_USER_ID}', 701, 'kelly', '[]'),
('${VIEWER_USER_ID}', 702, 'kelly', '[]'),
('${OTHER_VIEWER_USER_ID}', 703, 'mallory', '[]');

INSERT INTO github_installations (id, workspace_id, installation_id, account_login, permissions_json) VALUES
('00000000-0000-4000-8000-000000000111', '${WORKSPACE_ID}', 111, 'openclaw', '{"pull_requests":"write","checks":"read","actions":"read"}'),
('00000000-0000-4000-8000-000000000112', '${OTHER_WORKSPACE_ID}', 112, 'other', '{"pull_requests":"write","checks":"read","actions":"read"}');

INSERT INTO repositories (id, installation_id, github_repository_id, owner, name, full_name, private, default_branch, enabled) VALUES
('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000111', 201, 'openclaw', 'firmcode', 'openclaw/firmcode', false, 'main', true),
('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000112', 202, 'other', 'private-roadmap', 'other/private-roadmap', true, 'main', true);

INSERT INTO repository_access (repository_id, clerk_user_id, granted_by_clerk_user_id) VALUES
('00000000-0000-4000-8000-000000000201', '${DEVELOPER_USER_ID}', '${ADMIN_USER_ID}'),
('00000000-0000-4000-8000-000000000201', '${VIEWER_USER_ID}', '${ADMIN_USER_ID}'),
('00000000-0000-4000-8000-000000000202', '${OTHER_VIEWER_USER_ID}', NULL);

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
('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201', 301, 77, 'Fix payment tests', 'kelly', 'main', 'feature/payments', 'base-sha', 'head-sha-ci', 'open', false, '2026-05-23T09:55:00.000Z', '2026-05-23T10:05:00.000Z'),
('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000201', 302, 78, 'Harden integration tests', 'kelly', 'main', 'feature/flaky', 'base-sha', 'head-sha-flaky', 'open', false, '2026-05-22T09:55:00.000Z', '2026-05-22T10:05:00.000Z'),
('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000202', 303, 99, 'Secret acquisition roadmap', 'mallory', 'main', 'feature/private', 'base-sha', 'head-sha-private', 'open', false, '2026-05-23T08:00:00.000Z', '2026-05-23T08:05:00.000Z');

INSERT INTO github_deliveries (delivery_id, event_name, action) VALUES
('delivery-ci', 'check_run', 'completed'),
('delivery-flaky', 'check_run', 'completed'),
('delivery-other-ci', 'check_run', 'completed');

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
  created_at,
  updated_at
) VALUES
('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000301', 'delivery-ci', 'check_run.completed', 'head-sha-ci', 'succeeded', '2026-05-23T10:00:00.000Z', '2026-05-23T10:06:00.000Z', '2026-05-23T10:00:00.000Z', '2026-05-23T10:06:00.000Z'),
('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000302', 'delivery-flaky', 'check_run.completed', 'head-sha-flaky', 'succeeded', '2026-05-22T10:00:00.000Z', '2026-05-22T10:06:00.000Z', '2026-05-22T10:00:00.000Z', '2026-05-22T10:06:00.000Z'),
('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000303', 'delivery-other-ci', 'check_run.completed', 'head-sha-private', 'succeeded', '2026-05-23T08:00:00.000Z', '2026-05-23T08:06:00.000Z', '2026-05-23T08:00:00.000Z', '2026-05-23T08:06:00.000Z');
`
  );

  await pool.query(
    `
INSERT INTO analysis_artifacts (id, review_run_id, artifact_type, storage_key, metadata_json, created_at) VALUES
($1, '00000000-0000-4000-8000-000000000401', 'ci_failure_explanation', 'artifacts/run-401/ci-failure-explanation.json', $2::jsonb, '2026-05-23T10:06:00.000Z'),
($3, '00000000-0000-4000-8000-000000000401', 'ci_log', 'artifacts/run-401/ci-log.json', $4::jsonb, '2026-05-23T10:05:00.000Z'),
($5, '00000000-0000-4000-8000-000000000402', 'ci_failure_explanation', 'artifacts/run-402/ci-failure-explanation.json', $6::jsonb, '2026-05-22T10:06:00.000Z'),
($7, '00000000-0000-4000-8000-000000000403', 'ci_failure_explanation', 'artifacts/run-403/ci-failure-explanation.json', $8::jsonb, '2026-05-23T08:06:00.000Z')
`,
    [
      EXPLANATION_ARTIFACT_ID,
      JSON.stringify({ artifact: ciExplanation }),
      CI_LOG_ARTIFACT_ID,
      JSON.stringify({ artifact: ciLogArtifact }),
      FLAKY_EXPLANATION_ARTIFACT_ID,
      JSON.stringify({ artifact: flakyExplanation }),
      OTHER_EXPLANATION_ARTIFACT_ID,
      JSON.stringify({ artifact: otherExplanation })
    ]
  );
}
