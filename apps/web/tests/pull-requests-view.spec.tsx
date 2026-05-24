import React from "react";
import { renderToString } from "react-dom/server";
import type { PullRequestDetailResponse, PullRequestListResponse } from "@firmcode/shared";
import { PullRequestDetailView, PullRequestsView } from "../components/dashboard/pull-requests-view";

describe("PullRequestsView", () => {
  it("renders loading, empty, and error states", () => {
    expect(renderToString(<PullRequestsView state={{ status: "loading" }} />)).toContain("Loading pull requests");
    expect(renderToString(<PullRequestsView state={{ status: "empty", data: emptyPullRequests }} />)).toContain(
      "No pull requests match these filters"
    );
    expect(renderToString(<PullRequestsView state={{ status: "error", message: "API unavailable" }} />)).toContain(
      "Pull requests could not be loaded"
    );
  });

  it("renders all queue filters with selected values", () => {
    const html = renderToString(<PullRequestsView state={{ status: "populated", data: pullRequests }} />);

    expect(html).toContain('action="/pull-requests"');
    expect(html).toContain('name="repository"');
    expect(html).toContain('value="openclaw/firmcode"');
    expect(html).toContain('name="status"');
    expect(html).toContain('value="open" selected="">Open');
    expect(html).toContain('name="riskLevel"');
    expect(html).toContain('value="high" selected="">High');
    expect(html).toContain('name="reviewStatus"');
    expect(html).toContain('value="failed" selected="">Failed');
    expect(html).toContain('name="author"');
    expect(html).toContain('value="kelly"');
    expect(html).toContain('name="dateFrom"');
    expect(html).toContain('value="2026-05-20"');
    expect(html).toContain('name="dateTo"');
    expect(html).toContain('value="2026-05-24"');
  });

  it("renders populated queue rows and mobile cards", () => {
    const html = renderToString(<PullRequestsView state={{ status: "populated", data: pullRequests }} />);

    expect(html).toContain("Engineering review queue");
    expect(html).toContain("Add pull request dashboard");
    expect(html).toContain("openclaw/firmcode");
    expect(html).toContain("kelly");
    expect(html).toContain("High");
    expect(html).toContain("Failed");
    expect(html).toContain('href="/pull-requests/pr-1"');
    expect(html).toContain("md:hidden");
    expect(html).toContain("hidden overflow-x-auto md:block");
  });
});

describe("PullRequestDetailView", () => {
  it("renders loading, empty, and error states", () => {
    expect(renderToString(<PullRequestDetailView state={{ status: "loading" }} />)).toContain("Loading pull request detail");
    expect(renderToString(<PullRequestDetailView state={{ status: "empty" }} />)).toContain(
      "The pull request could not be found."
    );
    expect(renderToString(<PullRequestDetailView state={{ status: "error", message: "API unavailable" }} />)).toContain(
      "Pull requests could not be loaded"
    );
  });

  it("renders detail sections and read-only metadata links", () => {
    const html = renderToString(<PullRequestDetailView state={{ status: "populated", data: pullRequestDetail }} />);

    expect(html).toContain("Add pull request dashboard");
    expect(html).toContain("Summary");
    expect(html).toContain("Changed Components");
    expect(html).toContain("Risk Analysis");
    expect(html).toContain("Review Timeline");
    expect(html).toContain("Findings");
    expect(html).toContain("Metadata");
    expect(html).toContain("Branches");
    expect(html).toContain("Files Changed");
    expect(html).toContain("apps/web/app/pull-requests/page.tsx");
    expect(html).toContain("Review duration");
    expect(html).toContain('href="https://github.com/openclaw/firmcode/pull/7"');
    expect(html).toContain('href="/review-runs/run-1"');
    expect(html).not.toContain("Retry");
    expect(html).not.toContain("Configure");
  });
});

const pullRequests: PullRequestListResponse = {
  filters: {
    repository: "openclaw/firmcode",
    status: "open",
    riskLevel: "high",
    reviewStatus: "failed",
    author: "kelly",
    dateFrom: "2026-05-20",
    dateTo: "2026-05-24"
  },
  pagination: {
    limit: 50,
    returned: 1
  },
  pullRequests: [
    {
      id: "pr-1",
      repositoryId: "repo-1",
      repositoryFullName: "openclaw/firmcode",
      repositoryPrivate: false,
      number: 7,
      title: "Add pull request dashboard",
      authorLogin: "kelly",
      status: "open",
      state: "open",
      draft: false,
      baseRef: "main",
      headRef: "feature/pr-dashboard",
      headSha: "abc123def4567890",
      latestReview: {
        reviewRunId: "run-1",
        status: "failed",
        riskLevel: "high",
        findingsCount: 2,
        changedFilesCount: 3,
        durationMs: 124000,
        headSha: "abc123def4567890",
        createdAt: "2026-05-22T10:00:00.000Z",
        finishedAt: "2026-05-22T10:02:04.000Z"
      },
      riskLevel: "high",
      reviewStatus: "failed",
      githubUrl: "https://github.com/openclaw/firmcode/pull/7",
      createdAt: "2026-05-22T09:00:00.000Z",
      updatedAt: "2026-05-22T10:03:00.000Z"
    }
  ]
};

const emptyPullRequests: PullRequestListResponse = {
  filters: {},
  pagination: {
    limit: 50,
    returned: 0
  },
  pullRequests: []
};

const pullRequestDetail: PullRequestDetailResponse = {
  ...pullRequests.pullRequests[0],
  summary: "Firmcode reviewed the dashboard changes and found a route coverage issue.",
  changedComponents: ["apps/web", "components/dashboard"],
  riskAnalysis: {
    riskLevel: "high",
    riskFlags: ["auth", "ui-route"],
    summary: "The queue touches authenticated dashboard navigation and should keep read-only controls."
  },
  reviewTimeline: [
    {
      id: "run-1",
      repositoryId: "repo-1",
      pullRequestId: "pr-1",
      repositoryFullName: "openclaw/firmcode",
      pullRequestNumber: 7,
      pullRequestTitle: "Add pull request dashboard",
      pullRequestAuthor: "kelly",
      triggerEvent: "pull_request.synchronize",
      headSha: "abc123def4567890",
      status: "failed",
      findingsCount: 2,
      commentsPostedCount: 1,
      filesAnalyzedCount: 3,
      currentStage: "LLM Reviewed",
      durationMs: 124000,
      riskLevel: "high",
      startedAt: "2026-05-22T10:00:00.000Z",
      finishedAt: "2026-05-22T10:02:04.000Z",
      createdAt: "2026-05-22T10:00:00.000Z",
      updatedAt: "2026-05-22T10:02:04.000Z"
    }
  ],
  findings: [
    {
      id: "finding-1",
      reviewRunId: "run-1",
      source: "llm",
      category: "bug",
      severity: "high",
      confidence: "high",
      filePath: "apps/web/app/pull-requests/page.tsx",
      startLine: 12,
      endLine: 12,
      title: "Guard route loading",
      body: "The pull request route should render loading and error states.",
      evidence: [{ route: "/pull-requests" }],
      suggestion: "Add route-level loading state.",
      dedupeKey: "route-loading",
      postAsInline: true,
      postedInline: true,
      createdAt: "2026-05-22T10:01:00.000Z"
    }
  ],
  metadata: {
    repositoryId: "repo-1",
    repositoryFullName: "openclaw/firmcode",
    repositoryPrivate: false,
    reviewRunsCount: 1,
    findingsCount: 1,
    changedFilesCount: 1,
    latestReviewStatus: "failed"
  },
  branches: {
    baseRef: "main",
    headRef: "feature/pr-dashboard",
    baseSha: "base1234567890",
    headSha: "abc123def4567890"
  },
  commitSha: "abc123def4567890",
  changedFiles: [
    {
      id: "file-1",
      path: "apps/web/app/pull-requests/page.tsx",
      status: "added",
      additions: 82,
      deletions: 0,
      language: "TypeScript",
      isInfrastructure: false,
      isSupported: true,
      riskFlags: ["ui-route"],
      createdAt: "2026-05-22T10:00:00.000Z"
    }
  ],
  durationMs: 124000
};
