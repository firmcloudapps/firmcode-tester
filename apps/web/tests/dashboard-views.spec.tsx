import React from "react";
import { renderToString } from "react-dom/server";
import type { RepositoryListResponse, ReviewRunDetail, ReviewRunListResponse } from "@firmcode/shared";
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
    const html = renderToString(<RepositoriesView state={{ status: "populated", data: repositoryList }} />);

    expect(html).toContain("openclaw/firmcode");
    expect(html).toContain("Enabled");
    expect(html).toContain("PR #");
    expect(html).toContain(">7</a>");
    expect(html).toContain("View runs");
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
  ]
};
