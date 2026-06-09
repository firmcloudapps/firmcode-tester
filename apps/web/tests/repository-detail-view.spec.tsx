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

  it("renders the scans tab with manual scan controls, scan history, and open scan findings", () => {
    const html = renderToString(<RepositoryDetailView state={{ status: "populated", data: repositoryDetail }} activeTab="scans" />);

    expect(html).toContain("Codebase scans");
    expect(html).toContain("Scan now");
    expect(html).toContain("manual");
    expect(html).toContain("1<!-- --> open / <!-- -->2<!-- --> total");
    expect(html).toContain("Avoid shell execution");
    expect(html).toContain('href="/findings?findingType=codebase_scan&amp;repositoryId=repo-1"');
  });

  it("renders editable configuration for Developers and read-only configuration when denied", () => {
    const developerHtml = renderToString(
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

    expect(developerHtml).toContain("Developer/Admin controls are enabled");
    expect(developerHtml).toContain('role="switch"');
    expect(developerHtml).toContain('name="severityThreshold"');
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
    openCodebaseFindingsCount: 1,
    codebaseScan: {
      latestScanRunId: "scan-1",
      latestScanStatus: "succeeded",
      latestScanTrigger: "manual",
      latestScanCommitSha: "def456",
      latestScanStartedAt: "2026-05-22T09:00:00.000Z",
      latestScanFinishedAt: "2026-05-22T09:01:00.000Z",
      latestScanCreatedAt: "2026-05-22T09:00:00.000Z",
      openCodebaseFindingsCount: 1
    },
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
    codebaseScanEnabled: true,
    codebaseScanCadenceHours: 24,
    codebaseScanIgnoredPaths: ["dist/**"],
    codebaseScanSeverityThreshold: "medium",
    codebaseScanMaxFiles: 500,
    codebaseScanMaxBytes: 10000000,
    updatedByUserId: null,
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
  codebaseScans: [
    {
      id: "scan-1",
      repositoryId: "repo-1",
      repositoryFullName: "openclaw/firmcode",
      trigger: "manual",
      defaultBranch: "main",
      commitSha: "def456",
      status: "succeeded",
      startedAt: "2026-05-22T09:00:00.000Z",
      finishedAt: "2026-05-22T09:01:00.000Z",
      durationMs: 60000,
      findingsCount: 2,
      openFindingsCount: 1,
      errorCode: null,
      errorMessage: null,
      createdAt: "2026-05-22T09:00:00.000Z",
      updatedAt: "2026-05-22T09:01:00.000Z"
    }
  ],
  codebaseFindings: [
    {
      findingType: "codebase_scan",
      id: "codebase-finding-1",
      reviewRunId: null,
      scanRunId: "scan-1",
      repositoryId: "repo-1",
      repositoryFullName: "openclaw/firmcode",
      pullRequestNumber: null,
      pullRequestTitle: null,
      scanStatus: "succeeded",
      source: "semgrep",
      category: "security",
      severity: "critical",
      confidence: "high",
      filePath: "src/server.ts",
      startLine: 12,
      endLine: 12,
      title: "Avoid shell execution",
      body: "A background scan found request-controlled data reaching shell execution.",
      evidence: [],
      suggestion: "Use an allowlisted command wrapper.",
      dedupeKey: "codebase-finding-dashboard-1",
      postAsInline: false,
      postedInline: false,
      status: "open",
      semgrepRuleId: null,
      postedAt: null,
      githubCommentId: null,
      githubCommentUrl: null,
      reviewRunCreatedAt: null,
      scanRunCreatedAt: "2026-05-22T09:00:00.000Z",
      statusUpdatedAt: "2026-05-22T09:01:00.000Z",
      createdAt: "2026-05-22T09:00:00.000Z"
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
    canAccessRawArtifacts: true,
    canTriggerCodebaseScans: true,
    canManageCodebaseScans: true
  }
};
