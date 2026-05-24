import React from "react";
import { renderToString } from "react-dom/server";
import type { FindingsListResponse, RepositoryListResponse, ReviewRunDetail, ReviewRunListResponse } from "@firmcode/shared";
import { FindingsView } from "../components/dashboard/findings-view";
import { RepositoriesView } from "../components/dashboard/repositories-view";
import { ReviewRunDetailView } from "../components/dashboard/review-run-detail-view";
import { ReviewRunsView } from "../components/dashboard/review-runs-view";

describe("RepositoriesView", () => {
  it("renders loading, empty, and error states", () => {
    expect(renderToString(<RepositoriesView state={{ status: "loading" }} />)).toContain("Loading repositories");
    expect(renderToString(<RepositoriesView state={{ status: "empty" }} />)).toContain("No repositories yet");
    expect(renderToString(<RepositoriesView state={{ status: "error", message: "API unavailable" }} />)).toContain(
      "Repositories could not be loaded"
    );
  });

  it("renders populated repository rows with enabled status and last review", () => {
    const html = renderToString(
      <RepositoriesView
        state={{ status: "populated", data: repositoryList }}
        controlsState={{
          status: "ready",
          data: {
            oauth: connectedOAuth,
            settings: ownerSettings
          }
        }}
      />
    );

    expect(html).toContain("openclaw/firmcode");
    expect(html).toContain("Enabled");
    expect(html).toContain("PR #");
    expect(html).toContain(">7</a>");
    expect(html).toContain("View runs");
    expect(html).toContain("Sync GitHub");
    expect(html).toContain(">Manage GitHub App</a>");
    expect(html).not.toContain("not wired");
  });

  it("renders read-only repository controls for unauthorized roles and missing OAuth", () => {
    const html = renderToString(
      <RepositoriesView
        state={{ status: "populated", data: repositoryList }}
        controlsState={{
          status: "ready",
          data: {
            oauth: { connected: false, user: null },
            settings: viewerSettings
          }
        }}
      />
    );

    expect(html).toContain('href="/auth/github"');
    expect(html).toContain("Connect GitHub OAuth before syncing repositories.");
    expect(html).toContain("Connect GitHub first.");
  });
});

describe("ReviewRunsView", () => {
  it("renders loading, empty, and error states", () => {
    expect(renderToString(<ReviewRunsView state={{ status: "loading" }} />)).toContain("Loading review runs");
    expect(renderToString(<ReviewRunsView state={{ status: "empty" }} />)).toContain(
      "No review runs match these filters"
    );
    expect(renderToString(<ReviewRunsView state={{ status: "error", message: "API unavailable" }} />)).toContain(
      "Review runs could not be loaded"
    );
  });

  it("renders populated review run rows with filters and pipeline status", () => {
    const html = renderToString(<ReviewRunsView state={{ status: "populated", data: reviewRunList }} />);

    expect(html).toContain("Pipeline executions");
    expect(html).toContain("openclaw/firmcode");
    expect(html).toContain("Comments Published");
    expect(html).toContain("Succeeded");
  });
});

describe("ReviewRunDetailView", () => {
  it("renders loading, empty, and error states", () => {
    expect(renderToString(<ReviewRunDetailView state={{ status: "loading" }} />)).toContain("Loading review run detail");
    expect(renderToString(<ReviewRunDetailView state={{ status: "empty" }} />)).toContain(
      "review run could not be found"
    );
    expect(renderToString(<ReviewRunDetailView state={{ status: "error", message: "API unavailable" }} />)).toContain(
      "Review run detail could not be loaded"
    );
  });

  it("renders populated detail sections for files, findings, artifacts, logs, and comments", () => {
    const html = renderToString(<ReviewRunDetailView state={{ status: "populated", data: reviewRunDetail }} />);

    expect(html).toContain("Review Run #");
    expect(html).toContain("00000000");
    expect(html).toContain("Files");
    expect(html).toContain("apps/web/app/repositories/page.tsx");
    expect(html).toContain("Findings");
    expect(html).toContain("Guard repository access");
    expect(html).toContain("Artifacts");
    expect(html).toContain("artifacts/run-6/semgrep.json");
    expect(html).toContain("Logs");
    expect(html).toContain("PASS apps/web tests");
    expect(html).toContain("Published comments");
    expect(html).toContain("Inline body");
  });

  it("disables retry and raw artifact controls for read-only review detail permissions", () => {
    const viewerDetail: ReviewRunDetail = {
      ...reviewRunDetail,
      permissions: {
        canRetryReviewRun: false,
        canAccessRawArtifacts: false
      },
      artifacts: reviewRunDetail.artifacts.map((artifact) => ({
        ...artifact,
        storageKey: null,
        rawAccessAllowed: false,
        rawAccessUrl: null
      })),
      logExcerpts: reviewRunDetail.logExcerpts.map((log) => ({
        ...log,
        storageKey: null
      }))
    };
    const html = renderToString(<ReviewRunDetailView state={{ status: "populated", data: viewerDetail }} />);

    expect(html).toContain("Your workspace role cannot retry review runs.");
    expect(html).toContain("Raw artifact access requires Developer, Admin, or Owner.");
    expect(html).not.toContain("artifacts/run-6/semgrep.json");
  });
});

describe("FindingsView", () => {
  it("renders loading, empty, and error states", () => {
    expect(renderToString(<FindingsView state={{ status: "loading" }} />)).toContain("Loading findings");
    expect(renderToString(<FindingsView state={{ status: "empty", data: emptyFindingsList }} />)).toContain(
      "No findings match these filters"
    );
    expect(renderToString(<FindingsView state={{ status: "error", message: "API unavailable" }} />)).toContain(
      "Findings could not be loaded"
    );
  });

  it("renders all planned filters with selected values", () => {
    const html = renderToString(<FindingsView state={{ status: "populated", data: findingsList }} />);

    expect(html).toContain('name="severity"');
    expect(html).toContain('value="high" selected="">High');
    expect(html).toContain('name="source"');
    expect(html).toContain('value="semgrep" selected="">Semgrep');
    expect(html).toContain('name="category"');
    expect(html).toContain('value="security" selected="">Security');
    expect(html).toContain('name="repository"');
    expect(html).toContain('value="openclaw/firmcode"');
    expect(html).toContain('name="status"');
    expect(html).toContain('value="posted" selected="">Posted');
    expect(html).toContain('name="postedInline"');
    expect(html).toContain('value="true" selected="">Posted');
    expect(html).toContain('name="dateFrom"');
    expect(html).toContain('value="2026-05-22"');
    expect(html).toContain('name="dateTo"');
    expect(html).toContain('value="2026-05-23"');
  });

  it("renders populated finding rows and detail panels with evidence, suggested fix, rule ID, and links", () => {
    const html = renderToString(<FindingsView state={{ status: "populated", data: findingsList }} />);

    expect(html).toContain("Findings inbox");
    expect(html).toContain("Guard repository access");
    expect(html).toContain("apps/web/app/repositories/page.tsx");
    expect(html).toContain("High");
    expect(html).toContain("Posted inline");
    expect(html).toContain("View finding detail");
    expect(html).toContain("Repository access must be workspace scoped.");
    expect(html).toContain("workspace-scope");
    expect(html).toContain("Check workspace ownership");
    expect(html).toContain('href="/review-runs/00000000-0000-4000-8000-000000000006"');
    expect(html).toContain('href="https://github.com/openclaw/firmcode/pull/7#discussion_r8002"');
  });
});

const repositoryList: RepositoryListResponse = {
  filters: {},
  repositories: [
    {
      id: "repo-1",
      owner: "openclaw",
      name: "firmcode",
      fullName: "openclaw/firmcode",
      private: false,
      defaultBranch: "main",
      enabled: true,
      primaryLanguage: "TypeScript",
      openFindingsCount: 2,
      updatedAt: "2026-05-22T10:00:00.000Z",
      lastReview: {
        reviewRunId: "00000000-0000-4000-8000-000000000006",
        pullRequestNumber: 7,
        pullRequestTitle: "Add repository dashboard",
        status: "succeeded",
        headSha: "abc123def456",
        createdAt: "2026-05-22T10:00:00.000Z",
        finishedAt: "2026-05-22T10:02:00.000Z"
      }
    }
  ]
};

const connectedOAuth = {
  connected: true,
  user: {
    githubUserId: 42,
    login: "kelly",
    name: "Kelly",
    avatarUrl: null,
    connectedAt: "2026-05-22T09:00:00.000Z",
    updatedAt: "2026-05-22T09:00:00.000Z"
  }
};

const ownerSettings = {
  workspace: {
    id: "workspace-1",
    name: "Firmcode",
    clerkOrgId: "org_firmcode",
    role: "owner" as const,
    canManageSensitiveSettings: true
  },
  clerk: {
    userProfileUrl: "/user-profile",
    organizationProfileUrl: "/organization-profile",
    memberManagementUrl: "/organization-profile/members"
  },
  githubApp: {
    installUrl: "/github/installations",
    repositoryConfigurationUrl: "/repositories",
    installations: [
      {
        id: "install-1",
        installationId: 301,
        accountLogin: "openclaw",
        accountType: "Organization",
        repositoryCount: 2,
        enabledRepositoryCount: 1,
        updatedAt: "2026-05-22T10:00:00.000Z"
      }
    ]
  },
  retention: {
    artifactRetentionDays: 30,
    changedFilePatchDays: 30,
    fullSnapshotDays: 14,
    ciLogDays: 14,
    llmArtifactDays: 14,
    semgrepArtifactDays: 30,
    treeSitterArtifactDays: 30,
    findingMetadataDays: 180,
    aggregatedMetricDays: 365
  },
  apiKeys: {
    enabled: false,
    message: "Workspace API key creation is not enabled in the MVP."
  },
  notifications: {
    enabled: false,
    message: "Email and Slack notification routing is planned after review delivery stabilizes."
  }
};

const viewerSettings = {
  ...ownerSettings,
  workspace: {
    ...ownerSettings.workspace,
    role: "viewer" as const,
    canManageSensitiveSettings: false
  }
};

const reviewRunList: ReviewRunListResponse = {
  filters: {},
  reviewRuns: [
    {
      id: "00000000-0000-4000-8000-000000000006",
      repositoryId: "repo-1",
      pullRequestId: "pr-1",
      repositoryFullName: "openclaw/firmcode",
      pullRequestNumber: 7,
      pullRequestTitle: "Add repository dashboard",
      pullRequestAuthor: "kelly",
      triggerEvent: "pull_request.opened",
      headSha: "abc123def456",
      status: "succeeded",
      findingsCount: 2,
      commentsPostedCount: 1,
      filesAnalyzedCount: 2,
      currentStage: "Comments Published",
      durationMs: 120000,
      riskLevel: "high",
      startedAt: "2026-05-22T10:00:00.000Z",
      finishedAt: "2026-05-22T10:02:00.000Z",
      createdAt: "2026-05-22T10:00:00.000Z",
      updatedAt: "2026-05-22T10:02:00.000Z"
    }
  ]
};

const reviewRunDetail: ReviewRunDetail = {
  ...reviewRunList.reviewRuns[0],
  errorCode: null,
  errorMessage: null,
  metrics: { riskLevel: "high" },
  durationMs: 120000,
  semgrepFindingsCount: 1,
  aiFindingsCount: 1,
  inlineCommentsPostedCount: 1,
  tokenUsage: 1800,
  estimatedCostUsd: 0.12,
  pipelineStages: [
    {
      key: "webhook_received",
      label: "Webhook Received",
      status: "succeeded",
      durationMs: 100,
      errorMessage: null,
      artifactId: null
    },
    {
      key: "comments_published",
      label: "Comments Published",
      status: "succeeded",
      durationMs: 900,
      errorMessage: null,
      artifactId: null
    }
  ],
  changedFiles: [
    {
      id: "file-1",
      path: "apps/web/app/repositories/page.tsx",
      status: "added",
      additions: 42,
      deletions: 0,
      language: "TypeScript",
      isInfrastructure: false,
      isSupported: true,
      riskFlags: ["auth"],
      createdAt: "2026-05-22T10:00:00.000Z"
    }
  ],
  findings: [
    {
      id: "finding-1",
      source: "semgrep",
      category: "security",
      severity: "high",
      confidence: "high",
      filePath: "apps/web/app/repositories/page.tsx",
      startLine: 42,
      endLine: 42,
      title: "Guard repository access",
      body: "Repository access must be workspace scoped.",
      evidence: [{ excerpt: "repositoryId" }],
      suggestion: "Check workspace ownership before returning repository rows.",
      dedupeKey: "finding-dashboard-1",
      postAsInline: true,
      postedInline: true,
      createdAt: "2026-05-22T10:00:00.000Z"
    }
  ],
  artifacts: [
    {
      id: "artifact-1",
      artifactType: "semgrep",
      storageKey: "artifacts/run-6/semgrep.json",
      metadata: { findings: 1 },
      rawAccessAllowed: true,
      rawAccessRequiredRole: "developer",
      rawAccessUrl: "/api/review-runs/00000000-0000-4000-8000-000000000006/artifacts/artifact-1/raw",
      createdAt: "2026-05-22T10:00:00.000Z"
    }
  ],
  logExcerpts: [
    {
      id: "log-1",
      source: "ci_log",
      title: "unit tests",
      excerpt: "PASS apps/web tests",
      artifactId: "artifact-1",
      storageKey: "artifacts/run-6/ci-log.json",
      redacted: true,
      truncated: false,
      createdAt: "2026-05-22T10:00:00.000Z"
    }
  ],
  publishedComments: [
    {
      id: "comment-1",
      commentType: "summary",
      findingId: null,
      githubCommentId: 8001,
      githubReviewId: null,
      filePath: null,
      line: null,
      body: "Summary body",
      bodyHash: "summary-body-hash",
      dryRun: false,
      createdAt: "2026-05-22T10:00:00.000Z"
    },
    {
      id: "comment-2",
      commentType: "inline",
      findingId: "finding-1",
      githubCommentId: 8002,
      githubReviewId: 9001,
      filePath: "apps/web/app/repositories/page.tsx",
      line: 42,
      body: "Inline body",
      bodyHash: "inline-body-hash",
      dryRun: false,
      createdAt: "2026-05-22T10:00:00.000Z"
    }
  ],
  permissions: {
    canRetryReviewRun: true,
    canAccessRawArtifacts: true
  }
};

const emptyFindingsList: FindingsListResponse = {
  filters: {},
  findings: []
};

const findingsList: FindingsListResponse = {
  filters: {
    severity: "high",
    source: "semgrep",
    category: "security",
    repository: "openclaw/firmcode",
    status: "posted",
    postedInline: true,
    dateFrom: "2026-05-22",
    dateTo: "2026-05-23"
  },
  findings: [
    {
      id: "finding-1",
      reviewRunId: "00000000-0000-4000-8000-000000000006",
      repositoryId: "repo-1",
      repositoryFullName: "openclaw/firmcode",
      pullRequestNumber: 7,
      pullRequestTitle: "Add repository dashboard",
      source: "semgrep",
      category: "security",
      severity: "high",
      confidence: "high",
      filePath: "apps/web/app/repositories/page.tsx",
      startLine: 42,
      endLine: 42,
      title: "Guard repository access",
      body: "Repository access must be workspace scoped.",
      evidence: [
        {
          source: "semgrep",
          ruleId: "typescript.express.security.audit.workspace-scope",
          excerpt: "repositoryId"
        }
      ],
      suggestion: "Check workspace ownership before returning repository rows.",
      dedupeKey: "finding-dashboard-1",
      postAsInline: true,
      postedInline: true,
      status: "posted",
      semgrepRuleId: "typescript.express.security.audit.workspace-scope",
      postedAt: "2026-05-22T10:01:00.000Z",
      githubCommentId: 8002,
      githubCommentUrl: "https://github.com/openclaw/firmcode/pull/7#discussion_r8002",
      reviewRunCreatedAt: "2026-05-22T10:00:00.000Z",
      createdAt: "2026-05-22T10:00:00.000Z"
    }
  ]
};
