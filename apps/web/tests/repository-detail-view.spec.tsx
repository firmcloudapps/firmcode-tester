import React from "react";
import { renderToString } from "react-dom/server";
import type { RepositoryDetailResponse } from "@firmcode/shared";
import { RepositoryDetailView, parseRepositoryDetailTab } from "../components/dashboard/repository-detail-view";

describe("RepositoryDetailView", () => {
  it("renders loading, missing, and error states", () => {
    expect(renderToString(<RepositoryDetailView state={{ status: "loading" }} activeTab="overview" />)).toContain(
      "Loading repository detail"
    );
    expect(renderToString(<RepositoryDetailView state={{ status: "empty" }} activeTab="overview" />)).toContain(
      "Repository not found"
    );
    expect(
      renderToString(<RepositoryDetailView state={{ status: "error", message: "Dashboard API returned 403" }} activeTab="overview" />)
    ).toContain("Repository detail could not be loaded");
  });

  it("normalizes unknown repository detail tabs to Overview", () => {
    expect(parseRepositoryDetailTab("findings")).toBe("findings");
    expect(parseRepositoryDetailTab(["configuration"])).toBe("configuration");
    expect(parseRepositoryDetailTab("surprise")).toBe("overview");
    expect(parseRepositoryDetailTab(undefined)).toBe("overview");
  });

  it("renders the overview tab with repository metrics and latest review", () => {
    const html = renderToString(<RepositoryDetailView state={{ status: "populated", data: repositoryDetail }} activeTab="overview" />);

    expect(html).toContain("openclaw/firmcode");
    expect(html).toContain("Open findings");
    expect(html).toContain("Latest review");
    expect(html).toContain("Configuration summary");
    expect(html).toContain("PR #");
    expect(html).toContain(">7</a>");
  });

  it("renders the pull requests tab with latest run links", () => {
    const html = renderToString(
      <RepositoryDetailView state={{ status: "populated", data: repositoryDetail }} activeTab="pull-requests" />
    );

    expect(html).toContain("#7");
    expect(html).toContain("Add repository dashboard");
    expect(html).toContain("feature/dashboard");
    expect(html).toContain('href="/review-runs/run-1"');
  });

  it("renders the findings tab with actionable finding metadata", () => {
    const html = renderToString(<RepositoryDetailView state={{ status: "populated", data: repositoryDetail }} activeTab="findings" />);

    expect(html).toContain("Guard repository access");
    expect(html).toContain("Repository access must be workspace scoped.");
    expect(html).toContain("apps/web/app/repositories/page.tsx:42");
    expect(html).toContain("High");
  });

  it("renders editable configuration for owners and read-only configuration for lower roles", () => {
    const ownerHtml = renderToString(
      <RepositoryDetailView state={{ status: "populated", data: repositoryDetail }} activeTab="configuration" />
    );
    const viewerHtml = renderToString(
      <RepositoryDetailView
        state={{
          status: "populated",
          data: {
            ...repositoryDetail,
            permissions: {
              ...repositoryDetail.permissions,
              canManageConfiguration: false
            }
          }
        }}
        activeTab="configuration"
      />
    );

    expect(ownerHtml).toContain("Owner/Admin controls are enabled");
    expect(ownerHtml).toContain('role="switch"');
    expect(ownerHtml).toContain('name="severityThreshold"');
    expect(viewerHtml).toContain("Read-only configuration");
    expect(viewerHtml).toContain("disabled=\"\"");
  });

  it("renders the activity tab", () => {
    const html = renderToString(<RepositoryDetailView state={{ status: "populated", data: repositoryDetail }} activeTab="activity" />);

    expect(html).toContain("Review run succeeded");
    expect(html).toContain("PR #7 at abc123def456");
  });

  it("renders empty tab panels when repository-owned collections are empty", () => {
    const emptyDetail: RepositoryDetailResponse = {
      ...repositoryDetail,
      pullRequests: [],
      findings: [],
      activity: []
    };

    expect(renderToString(<RepositoryDetailView state={{ status: "populated", data: emptyDetail }} activeTab="pull-requests" />)).toContain(
      "No pull requests yet"
    );
    expect(renderToString(<RepositoryDetailView state={{ status: "populated", data: emptyDetail }} activeTab="findings" />)).toContain(
      "No findings yet"
    );
    expect(renderToString(<RepositoryDetailView state={{ status: "populated", data: emptyDetail }} activeTab="activity" />)).toContain(
      "No activity yet"
    );
  });
});

const repositoryDetail: RepositoryDetailResponse = {
  repository: {
    id: "repo-1",
    owner: "openclaw",
    name: "firmcode",
    fullName: "openclaw/firmcode",
    private: false,
    defaultBranch: "main",
    enabled: true,
    primaryLanguage: "TypeScript",
    openFindingsCount: 1,
    updatedAt: "2026-05-22T10:00:00.000Z",
    lastReview: {
      reviewRunId: "run-1",
      pullRequestNumber: 7,
      pullRequestTitle: "Add repository dashboard",
      status: "succeeded",
      headSha: "abc123def456",
      createdAt: "2026-05-22T10:00:00.000Z",
      finishedAt: "2026-05-22T10:02:00.000Z"
    }
  },
  configuration: {
    repositoryId: "repo-1",
    automationEnabled: true,
    draftPullRequestReviewsEnabled: false,
    maxInlineComments: 10,
    severityThreshold: "medium",
    semgrepEnabled: true,
    treeSitterEnabled: true,
    ciExplanationEnabled: true,
    infrastructureReviewEnabled: true,
    dryRunEnabled: true,
    updatedByClerkUserId: null,
    createdAt: "2026-05-22T09:00:00.000Z",
    updatedAt: "2026-05-22T09:00:00.000Z"
  },
  pullRequests: [
    {
      id: "pr-1",
      number: 7,
      title: "Add repository dashboard",
      authorLogin: "kelly",
      baseRef: "main",
      headRef: "feature/dashboard",
      state: "open",
      draft: false,
      latestReviewRun: {
        reviewRunId: "run-1",
        pullRequestNumber: 7,
        pullRequestTitle: "Add repository dashboard",
        status: "succeeded",
        headSha: "abc123def456",
        createdAt: "2026-05-22T10:00:00.000Z",
        finishedAt: "2026-05-22T10:02:00.000Z"
      },
      updatedAt: "2026-05-22T10:00:00.000Z"
    }
  ],
  reviewRuns: [
    {
      id: "run-1",
      repositoryId: "repo-1",
      pullRequestId: "pr-1",
      repositoryFullName: "openclaw/firmcode",
      pullRequestNumber: 7,
      pullRequestTitle: "Add repository dashboard",
      pullRequestAuthor: "kelly",
      triggerEvent: "pull_request.opened",
      headSha: "abc123def456",
      status: "succeeded",
      findingsCount: 1,
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
  ],
  findings: [
    {
      id: "finding-1",
      reviewRunId: "run-1",
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
      evidence: [],
      suggestion: "Check workspace ownership before returning repository rows.",
      dedupeKey: "finding-1",
      postAsInline: true,
      postedInline: true,
      status: "posted",
      semgrepRuleId: "rule.id",
      postedAt: "2026-05-22T10:01:00.000Z",
      githubCommentId: 8002,
      githubCommentUrl: "https://github.com/openclaw/firmcode/pull/7#discussion_r8002",
      reviewRunCreatedAt: "2026-05-22T10:00:00.000Z",
      createdAt: "2026-05-22T10:00:00.000Z"
    }
  ],
  activity: [
    {
      id: "run:run-1",
      kind: "review_run_updated",
      title: "Review run succeeded",
      detail: "PR #7 at abc123def456",
      createdAt: "2026-05-22T10:02:00.000Z"
    }
  ],
  permissions: {
    canManageConfiguration: true,
    canRetryReviewRuns: true,
    canAccessRawArtifacts: true
  }
};
