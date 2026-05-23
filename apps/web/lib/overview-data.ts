import type {
  OverviewAttentionItem,
  OverviewDashboardData,
  OverviewMetric,
  OverviewQualityMetric,
  OverviewSupplementData,
  RepositoryListItem,
  ReviewFindingSeverity,
  ReviewRunListItem,
  ReviewRunStatus
} from "@firmcode/shared";

interface BuildOverviewInput {
  repositories: RepositoryListItem[];
  reviewRuns: ReviewRunListItem[];
  supplement?: OverviewSupplementData;
  now?: Date;
}

const DEFAULT_OVERVIEW_SUPPLEMENT: OverviewSupplementData = {
  securityFindingsCount: 4,
  ciFailuresExplainedCount: 2,
  highSeverityFindings: [
    {
      id: "fixture-high-severity-auth",
      kind: "high_severity_finding",
      title: "High severity finding",
      detail: "openclaw/firmcode has an authentication-path finding awaiting triage.",
      href: "/findings?severity=high",
      severity: "high",
      updatedAt: "2026-05-22T09:30:00.000Z"
    }
  ],
  ciFailures: [
    {
      id: "fixture-ci-failure-unit",
      kind: "ci_failure",
      title: "CI failure",
      detail: "firmcode dashboard tests need a failure explanation review.",
      href: "/ci-failures?status=open",
      severity: "medium",
      updatedAt: "2026-05-22T08:45:00.000Z"
    }
  ],
  incompleteRepositoryConfigurationRepositoryIds: [],
  qualityMetrics: [
    {
      label: "Inline comment rate",
      value: "42%",
      helper: "Findings posted inline",
      tone: "info"
    },
    {
      label: "Median duration",
      value: "2m 10s",
      helper: "Recent review runs",
      tone: "success"
    },
    {
      label: "Dry-run safety",
      value: "On",
      helper: "Publishing guarded",
      tone: "success"
    }
  ]
};

const EMPTY_OVERVIEW_SUPPLEMENT: OverviewSupplementData = {
  securityFindingsCount: 0,
  ciFailuresExplainedCount: 0,
  highSeverityFindings: [],
  ciFailures: [],
  incompleteRepositoryConfigurationRepositoryIds: [],
  qualityMetrics: []
};

const numberFormatter = new Intl.NumberFormat("en");

export function buildOverviewDashboardData(input: BuildOverviewInput): OverviewDashboardData {
  const supplement = input.supplement ?? DEFAULT_OVERVIEW_SUPPLEMENT;
  const now = input.now ?? new Date();
  const recentReviewRuns = [...input.reviewRuns]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 6);
  const enabledRepositories = input.repositories.filter((repository) => repository.enabled);
  const disabledRepositories = input.repositories.filter((repository) => !repository.enabled);
  const currentReviewActivity = countRunsInWindow(input.reviewRuns, now, 7, 0);
  const previousReviewActivity = countRunsInWindow(input.reviewRuns, now, 14, 7);
  const failedRuns = input.reviewRuns.filter((run) => run.status === "failed");
  const incompleteRepositoryItems = buildIncompleteRepositoryItems(input.repositories, supplement);
  const needsAttention = [
    ...failedRuns.map(toFailedRunAttentionItem),
    ...supplement.highSeverityFindings,
    ...supplement.ciFailures,
    ...incompleteRepositoryItems
  ]
    .sort(compareAttentionItems)
    .slice(0, 8);

  return {
    metrics: [
      buildMetric({
        id: "review_activity",
        label: "Review Activity",
        value: currentReviewActivity,
        helper: "Reviews in the last 7 days",
        change: currentReviewActivity - previousReviewActivity,
        trend: buildStatusTrend(input.reviewRuns),
        tone: failedRuns.length > 0 ? "warning" : "success"
      }),
      {
        id: "security_findings",
        label: "Security Findings",
        value: supplement.securityFindingsCount,
        helper: "Open security findings",
        changeLabel: `${formatOverviewCount(supplement.highSeverityFindings.length)} high severity`,
        trend: [0, supplement.highSeverityFindings.length, supplement.securityFindingsCount],
        tone: supplement.highSeverityFindings.length > 0 ? "critical" : "success"
      },
      {
        id: "ci_failures",
        label: "CI Failures Explained",
        value: supplement.ciFailuresExplainedCount,
        helper: "Failures with summaries",
        changeLabel: `${formatOverviewCount(supplement.ciFailures.length)} needs attention`,
        trend: [0, supplement.ciFailures.length, supplement.ciFailuresExplainedCount],
        tone: supplement.ciFailures.length > 0 ? "warning" : "success"
      },
      {
        id: "repositories_monitored",
        label: "Repositories Monitored",
        value: enabledRepositories.length,
        helper: "Automation enabled",
        changeLabel: `${formatOverviewCount(disabledRepositories.length)} disabled`,
        trend: [input.repositories.length, enabledRepositories.length],
        tone: disabledRepositories.length > 0 ? "info" : "success"
      }
    ],
    recentReviewRuns,
    needsAttention,
    qualityMetrics: supplement.qualityMetrics,
    generatedAt: now.toISOString(),
    dataSource: hasSupplementData(supplement) ? "dashboard_api_with_local_supplement" : "dashboard_api"
  };
}

export function buildEmptyOverviewDashboardData(now = new Date()): OverviewDashboardData {
  return buildOverviewDashboardData({
    repositories: [],
    reviewRuns: [],
    supplement: EMPTY_OVERVIEW_SUPPLEMENT,
    now
  });
}

export function formatOverviewCount(value: number): string {
  return numberFormatter.format(value);
}

export function formatOverviewStatus(status: ReviewRunStatus): string {
  return formatTitleCase(status);
}

export function formatOverviewSeverity(severity: ReviewFindingSeverity | "none"): string {
  return severity === "none" ? "Needs review" : formatTitleCase(severity);
}

function formatTitleCase(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getRecentReviewRunHref(run: Pick<ReviewRunListItem, "id">): string {
  return `/review-runs/${encodeURIComponent(run.id)}`;
}

function buildMetric(input: {
  id: OverviewMetric["id"];
  label: string;
  value: number;
  helper: string;
  change: number;
  trend: number[];
  tone: OverviewMetric["tone"];
}): OverviewMetric {
  return {
    id: input.id,
    label: input.label,
    value: input.value,
    helper: input.helper,
    changeLabel: `${input.change >= 0 ? "+" : ""}${formatOverviewCount(input.change)} vs prior 7d`,
    trend: input.trend,
    tone: input.tone
  };
}

function countRunsInWindow(reviewRuns: ReviewRunListItem[], now: Date, daysAgoStart: number, daysAgoEnd: number): number {
  const start = now.getTime() - daysAgoStart * 24 * 60 * 60 * 1000;
  const end = now.getTime() - daysAgoEnd * 24 * 60 * 60 * 1000;

  return reviewRuns.filter((run) => {
    const createdAt = Date.parse(run.createdAt);
    return createdAt >= start && createdAt <= end;
  }).length;
}

function buildStatusTrend(reviewRuns: ReviewRunListItem[]): number[] {
  const statuses: ReviewRunStatus[] = ["queued", "running", "succeeded", "failed", "cancelled", "superseded"];

  return statuses.map((status) => reviewRuns.filter((run) => run.status === status).length);
}

function buildIncompleteRepositoryItems(
  repositories: RepositoryListItem[],
  supplement: OverviewSupplementData
): OverviewAttentionItem[] {
  const explicitIds = new Set(supplement.incompleteRepositoryConfigurationRepositoryIds);

  return repositories
    .filter((repository) => explicitIds.has(repository.id) || !repository.enabled)
    .map((repository) => ({
      id: `repo-config-${repository.id}`,
      kind: "incomplete_repository_configuration",
      title: "Incomplete repository configuration",
      detail: `${repository.fullName} needs review automation configuration.`,
      href: `/repositories/${encodeURIComponent(repository.id)}`,
      severity: "none",
      updatedAt: repository.updatedAt
    }));
}

function toFailedRunAttentionItem(run: ReviewRunListItem): OverviewAttentionItem {
  return {
    id: `failed-run-${run.id}`,
    kind: "failed_job",
    title: "Failed review job",
    detail: `${run.repositoryFullName} PR #${run.pullRequestNumber} stopped at ${run.currentStage}.`,
    href: getRecentReviewRunHref(run),
    severity: "critical",
    updatedAt: run.updatedAt
  };
}

function compareAttentionItems(left: OverviewAttentionItem, right: OverviewAttentionItem): number {
  const severityDelta = severityRank(right.severity) - severityRank(left.severity);

  if (severityDelta !== 0) {
    return severityDelta;
  }

  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function severityRank(severity: ReviewFindingSeverity | "none"): number {
  switch (severity) {
    case "critical":
      return 5;
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    case "info":
      return 1;
    case "none":
      return 0;
  }
}

function hasSupplementData(supplement: OverviewSupplementData): boolean {
  return (
    supplement.securityFindingsCount > 0 ||
    supplement.ciFailuresExplainedCount > 0 ||
    supplement.highSeverityFindings.length > 0 ||
    supplement.ciFailures.length > 0 ||
    supplement.incompleteRepositoryConfigurationRepositoryIds.length > 0 ||
    supplement.qualityMetrics.length > 0
  );
}
