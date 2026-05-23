import React from "react";
import { renderToString } from "react-dom/server";
import type { OverviewSupplementData, RepositoryListItem, ReviewRunListItem } from "@firmcode/shared";
import { DashboardShell } from "../components/dashboard/dashboard-shell";
import { OverviewView } from "../components/dashboard/overview-view";
import {
  buildEmptyOverviewDashboardData,
  buildOverviewDashboardData,
  formatOverviewCount,
  formatOverviewSeverity,
  formatOverviewStatus,
  getRecentReviewRunHref
} from "../lib/overview-data";

describe("OverviewView", () => {
  it("renders loading, empty, and error states", () => {
    expect(renderToString(<OverviewView state={{ status: "loading" }} />)).toContain("Loading overview");
    expect(
      renderToString(
        <OverviewView state={{ status: "empty", data: buildEmptyOverviewDashboardData(new Date("2026-05-23T12:00:00.000Z")) }} />
      )
    ).toContain("No review activity yet");
    expect(renderToString(<OverviewView state={{ status: "error", message: "API unavailable" }} />)).toContain(
      "Overview could not be loaded"
    );
  });

  it("renders populated metrics, recent runs, needs-attention items, and quality metrics", () => {
    const data = buildOverviewDashboardData({
      repositories,
      reviewRuns,
      supplement,
      now: new Date("2026-05-23T12:00:00.000Z")
    });
    const html = renderToString(<OverviewView state={{ status: "populated", data }} />);

    expect(html).toContain("Review Activity");
    expect(html).toContain("Security Findings");
    expect(html).toContain("CI Failures Explained");
    expect(html).toContain("Repositories Monitored");
    expect(html).toContain("Recent Review Runs");
    expect(html).toContain("openclaw/firmcode");
    expect(html).toContain('href="/review-runs/00000000-0000-4000-8000-000000000006"');
    expect(html).toContain("Needs Attention");
    expect(html).toContain("Failed review job");
    expect(html).toContain("High severity finding");
    expect(html).toContain("CI failure");
    expect(html).toContain("Incomplete repository configuration");
    expect(html).toContain("Review Quality");
    expect(html).toContain("Inline comment rate");
  });

  it("formats counts, statuses, severities, and recent review run links", () => {
    expect(formatOverviewCount(1200)).toBe("1,200");
    expect(formatOverviewStatus("superseded")).toBe("Superseded");
    expect(formatOverviewSeverity("critical")).toBe("Critical");
    expect(formatOverviewSeverity("none")).toBe("Needs review");
    expect(getRecentReviewRunHref({ id: "run with spaces" })).toBe("/review-runs/run%20with%20spaces");
  });

  it("keeps overview behind the Clerk-authenticated dashboard shell scaffold", () => {
    const html = renderToString(
      <DashboardShell activeItem="Overview">
        <OverviewView state={{ status: "populated", data: overviewData }} />
      </DashboardShell>
    );

    expect(html).toContain('data-clerk-authenticated="required"');
    expect(html).toContain('aria-current="page"');
  });
});

const repositories: RepositoryListItem[] = [
  {
    id: "repo-1",
    owner: "openclaw",
    name: "firmcode",
    fullName: "openclaw/firmcode",
    private: false,
    defaultBranch: "main",
    enabled: true,
    primaryLanguage: "TypeScript",
    openFindingsCount: 3,
    lastReview: null,
    updatedAt: "2026-05-22T10:00:00.000Z"
  },
  {
    id: "repo-2",
    owner: "openclaw",
    name: "infra",
    fullName: "openclaw/infra",
    private: true,
    defaultBranch: "main",
    enabled: false,
    primaryLanguage: "HCL",
    openFindingsCount: 1,
    lastReview: null,
    updatedAt: "2026-05-22T09:00:00.000Z"
  }
];

const reviewRuns: ReviewRunListItem[] = [
  {
    id: "00000000-0000-4000-8000-000000000006",
    repositoryId: "repo-1",
    pullRequestId: "pr-1",
    repositoryFullName: "openclaw/firmcode",
    pullRequestNumber: 7,
    pullRequestTitle: "Add overview dashboard",
    pullRequestAuthor: "kelly",
    triggerEvent: "pull_request.opened",
    currentStage: "Comments Published",
    durationMs: 120000,
    commentsPostedCount: 2,
    filesAnalyzedCount: 4,
    riskLevel: "high",
    headSha: "abc123def456",
    status: "succeeded",
    findingsCount: 4,
    startedAt: "2026-05-22T10:00:00.000Z",
    finishedAt: "2026-05-22T10:02:00.000Z",
    createdAt: "2026-05-22T10:00:00.000Z",
    updatedAt: "2026-05-22T10:02:00.000Z"
  },
  {
    id: "00000000-0000-4000-8000-000000000007",
    repositoryId: "repo-2",
    pullRequestId: "pr-2",
    repositoryFullName: "openclaw/infra",
    pullRequestNumber: 11,
    pullRequestTitle: "Update workflow permissions",
    pullRequestAuthor: "avery",
    triggerEvent: "pull_request.synchronize",
    currentStage: "Semgrep Scanned",
    durationMs: null,
    commentsPostedCount: 0,
    filesAnalyzedCount: 2,
    riskLevel: "medium",
    headSha: "def456abc123",
    status: "failed",
    findingsCount: 1,
    startedAt: "2026-05-22T09:00:00.000Z",
    finishedAt: null,
    createdAt: "2026-05-22T09:00:00.000Z",
    updatedAt: "2026-05-22T09:04:00.000Z"
  }
];

const supplement: OverviewSupplementData = {
  securityFindingsCount: 5,
  ciFailuresExplainedCount: 2,
  highSeverityFindings: [
    {
      id: "finding-1",
      kind: "high_severity_finding",
      title: "High severity finding",
      detail: "openclaw/infra has an unpinned workflow action.",
      href: "/findings?severity=high",
      severity: "high",
      updatedAt: "2026-05-22T09:30:00.000Z"
    }
  ],
  ciFailures: [
    {
      id: "ci-1",
      kind: "ci_failure",
      title: "CI failure",
      detail: "Unit test failure needs triage.",
      href: "/ci-failures?status=open",
      severity: "medium",
      updatedAt: "2026-05-22T09:15:00.000Z"
    }
  ],
  incompleteRepositoryConfigurationRepositoryIds: ["repo-2"],
  qualityMetrics: [
    {
      label: "Inline comment rate",
      value: "50%",
      helper: "Findings posted inline",
      tone: "info"
    }
  ]
};

const overviewData = buildOverviewDashboardData({
  repositories,
  reviewRuns,
  supplement,
  now: new Date("2026-05-23T12:00:00.000Z")
});
