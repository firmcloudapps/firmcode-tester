import type { ReviewRunStatus } from "../enums/review-run-status";
import type { ChangedFileRiskClassification } from "../risk/changed-file-risk";
import type { LargePullRequestReviewArtifact, ReviewSkippedFileReport } from "../review/large-pr-handling";

export interface ReviewRunSummary {
  id: string;
  repositoryId: string;
  pullRequestId: string;
  repositoryFullName: string;
  pullRequestNumber: number;
  pullRequestTitle: string;
  headSha: string;
  status: ReviewRunStatus;
  findingsCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardRepositoryListFilters {
  enabled?: boolean;
  private?: boolean;
  language?: string;
}

export interface RepositoryLastReview {
  reviewRunId: string;
  pullRequestNumber: number;
  pullRequestTitle: string;
  status: ReviewRunStatus;
  headSha: string;
  createdAt: string;
  finishedAt: string | null;
}

export interface RepositoryListItem {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  enabled: boolean;
  primaryLanguage: string | null;
  openFindingsCount: number;
  lastReview: RepositoryLastReview | null;
  updatedAt: string;
}

export interface RepositoryListResponse {
  repositories: RepositoryListItem[];
  filters: DashboardRepositoryListFilters;
}

export const REPOSITORY_REVIEW_SEVERITY_THRESHOLDS = ["info", "low", "medium", "high", "critical"] as const;

export type RepositoryReviewSeverityThreshold = (typeof REPOSITORY_REVIEW_SEVERITY_THRESHOLDS)[number];

export interface RepositoryReviewConfiguration {
  repositoryId: string;
  automationEnabled: boolean;
  draftPullRequestReviewsEnabled: boolean;
  maxInlineComments: number;
  severityThreshold: RepositoryReviewSeverityThreshold;
  semgrepEnabled: boolean;
  treeSitterEnabled: boolean;
  ciExplanationEnabled: boolean;
  infrastructureReviewEnabled: boolean;
  dryRunEnabled: boolean;
  updatedByClerkUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UpdateRepositoryReviewConfigurationRequest = Partial<
  Pick<
    RepositoryReviewConfiguration,
    | "automationEnabled"
    | "draftPullRequestReviewsEnabled"
    | "maxInlineComments"
    | "severityThreshold"
    | "semgrepEnabled"
    | "treeSitterEnabled"
    | "ciExplanationEnabled"
    | "infrastructureReviewEnabled"
    | "dryRunEnabled"
  >
>;

export type ReviewRunRiskLevel = "low" | "medium" | "high" | "unknown";

export interface ReviewRunListFilters {
  status?: ReviewRunStatus;
  repositoryId?: string;
  repository?: string;
  triggerEvent?: string;
  risk?: Exclude<ReviewRunRiskLevel, "unknown">;
  dateFrom?: string;
  dateTo?: string;
}

export interface ReviewRunListItem extends ReviewRunSummary {
  triggerEvent: string;
  currentStage: string;
  durationMs: number | null;
  commentsPostedCount: number;
  filesAnalyzedCount: number;
  riskLevel: ReviewRunRiskLevel;
  pullRequestAuthor: string;
}

export interface ReviewRunListResponse {
  reviewRuns: ReviewRunListItem[];
  filters: ReviewRunListFilters;
}

export type ReviewRunRetryReason =
  | "retry_queued"
  | "duplicate_retry"
  | "run_not_failed"
  | "deterministic_validation_failure";

export interface ReviewRunRetryResponse {
  originalRunId: string;
  retryRunId: string | null;
  retryJobId: string | null;
  status: ReviewRunStatus;
  reason: ReviewRunRetryReason;
  message: string;
}

export interface ReviewRunPublishedComment {
  id: string;
  commentType: "summary" | "inline" | "review";
  findingId: string | null;
  githubCommentId: number | null;
  githubReviewId: number | null;
  filePath: string | null;
  line: number | null;
  body: string | null;
  bodyHash: string;
  dryRun: boolean;
  createdAt: string;
}

export interface ReviewRunChangedFile {
  id: string;
  path: string;
  status: string;
  additions: number;
  deletions: number;
  language: string | null;
  isInfrastructure: boolean;
  isSupported: boolean;
  riskFlags: string[];
  createdAt: string;
}

export type ReviewFindingSource = "semgrep" | "llm" | "ci" | "policy";
export type ReviewFindingCategory = "bug" | "security" | "performance" | "maintainability" | "test" | "infra" | "ci";
export type ReviewFindingSeverity = "info" | "low" | "medium" | "high" | "critical";
export type ReviewFindingConfidence = "low" | "medium" | "high";
export type ReviewFindingStatus = "open" | "posted" | "suppressed" | "resolved" | "false_positive";

export const REVIEW_FINDING_SOURCES: readonly ReviewFindingSource[] = ["semgrep", "llm", "ci", "policy"] as const;
export const REVIEW_FINDING_CATEGORIES: readonly ReviewFindingCategory[] = [
  "bug",
  "security",
  "performance",
  "maintainability",
  "test",
  "infra",
  "ci"
] as const;
export const REVIEW_FINDING_SEVERITIES: readonly ReviewFindingSeverity[] = ["info", "low", "medium", "high", "critical"] as const;
export const REVIEW_FINDING_STATUSES: readonly ReviewFindingStatus[] = [
  "open",
  "posted",
  "suppressed",
  "resolved",
  "false_positive"
] as const;

export interface ReviewRunFinding {
  id: string;
  source: ReviewFindingSource;
  category: ReviewFindingCategory;
  severity: ReviewFindingSeverity;
  confidence: ReviewFindingConfidence;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  title: string;
  body: string;
  evidence: unknown[];
  suggestion: string | null;
  dedupeKey: string;
  postAsInline: boolean;
  postedInline: boolean;
  createdAt: string;
}

export interface FindingsListFilters {
  severity?: ReviewFindingSeverity;
  source?: ReviewFindingSource;
  category?: ReviewFindingCategory;
  repositoryId?: string;
  repository?: string;
  status?: ReviewFindingStatus;
  postedInline?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface FindingInboxItem extends ReviewRunFinding {
  reviewRunId: string;
  repositoryId: string;
  repositoryFullName: string;
  pullRequestNumber: number;
  pullRequestTitle: string;
  status: ReviewFindingStatus;
  semgrepRuleId: string | null;
  postedAt: string | null;
  githubCommentId: number | null;
  githubCommentUrl: string | null;
  reviewRunCreatedAt: string;
}

export interface FindingsListResponse {
  findings: FindingInboxItem[];
  filters: FindingsListFilters;
}

export type ReviewRunArtifactType = "diff" | "treesitter" | "semgrep" | "context_pack" | "llm_raw" | "ci_log";

export interface ReviewRunArtifact {
  id: string;
  artifactType: ReviewRunArtifactType;
  storageKey: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ReviewRunLogExcerpt {
  id: string;
  source: "ci_log" | "worker" | "system";
  title: string;
  excerpt: string;
  artifactId: string | null;
  storageKey: string | null;
  redacted: boolean;
  truncated: boolean;
  createdAt: string;
}

export type ReviewPipelineStageStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

export interface ReviewPipelineStage {
  key: string;
  label: string;
  status: ReviewPipelineStageStatus;
  durationMs: number | null;
  errorMessage: string | null;
  artifactId: string | null;
}

export interface ReviewRunDetail extends ReviewRunSummary {
  triggerEvent: string;
  errorCode: string | null;
  errorMessage: string | null;
  metrics: Record<string, unknown>;
  durationMs: number | null;
  filesAnalyzedCount: number;
  semgrepFindingsCount: number;
  aiFindingsCount: number;
  inlineCommentsPostedCount: number;
  tokenUsage: number | null;
  estimatedCostUsd: number | null;
  riskLevel: ReviewRunRiskLevel;
  pipelineStages: ReviewPipelineStage[];
  changedFiles: ReviewRunChangedFile[];
  findings: ReviewRunFinding[];
  artifacts: ReviewRunArtifact[];
  logExcerpts: ReviewRunLogExcerpt[];
  publishedComments: ReviewRunPublishedComment[];
}

export type OverviewMetricId = "review_activity" | "security_findings" | "ci_failures" | "repositories_monitored";
export type OverviewTone = "neutral" | "info" | "success" | "warning" | "critical";

export interface OverviewMetric {
  id: OverviewMetricId;
  label: string;
  value: number;
  helper: string;
  changeLabel: string;
  trend: number[];
  tone: OverviewTone;
}

export type OverviewAttentionKind =
  | "failed_job"
  | "high_severity_finding"
  | "ci_failure"
  | "incomplete_repository_configuration";

export interface OverviewAttentionItem {
  id: string;
  kind: OverviewAttentionKind;
  title: string;
  detail: string;
  href: string;
  severity: ReviewFindingSeverity | "none";
  updatedAt: string;
}

export interface OverviewQualityMetric {
  label: string;
  value: string;
  helper: string;
  tone: OverviewTone;
}

export interface OverviewSupplementData {
  securityFindingsCount: number;
  ciFailuresExplainedCount: number;
  highSeverityFindings: OverviewAttentionItem[];
  ciFailures: OverviewAttentionItem[];
  incompleteRepositoryConfigurationRepositoryIds: string[];
  qualityMetrics: OverviewQualityMetric[];
}

export interface OverviewDashboardData {
  metrics: OverviewMetric[];
  recentReviewRuns: ReviewRunListItem[];
  needsAttention: OverviewAttentionItem[];
  qualityMetrics: OverviewQualityMetric[];
  generatedAt: string;
  dataSource: "dashboard_api" | "dashboard_api_with_local_supplement";
}

export const DEFAULT_REVIEW_LIMITS = {
  maxInlineComments: 10,
  artifactRetentionDays: 30
} as const;

export interface ReviewContextPack {
  schemaVersion: "review-context/v1";
  reviewRunId: string;
  repositoryFullName: string;
  pullRequestNumber: number;
  headSha: string;
  files: ReviewContextFile[];
  largePullRequest?: LargePullRequestReviewArtifact;
  skippedFiles?: ReviewSkippedFileReport[];
}

export interface ReviewContextFile {
  path: string;
  previousPath: string | null;
  status: string;
  additions: number;
  deletions: number;
  language: string | null;
  risk: ChangedFileRiskClassification;
}
