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

export type CodebaseScanStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "superseded";
export type CodebaseScanTrigger = "install" | "scheduled" | "manual" | "push";
export type CodebaseScanFindingSource = "semgrep" | "llm" | "tree_sitter" | "ci" | "policy";
export type CodebaseScanFindingStatus = "open" | "resolved" | "suppressed" | "false_positive";

export const CODEBASE_SCAN_STATUSES: readonly CodebaseScanStatus[] = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "superseded"
] as const;
export const CODEBASE_SCAN_TRIGGERS: readonly CodebaseScanTrigger[] = ["install", "scheduled", "manual", "push"] as const;
export const CODEBASE_SCAN_FINDING_SOURCES: readonly CodebaseScanFindingSource[] = [
  "semgrep",
  "llm",
  "tree_sitter",
  "ci",
  "policy"
] as const;
export const CODEBASE_SCAN_FINDING_STATUSES: readonly CodebaseScanFindingStatus[] = [
  "open",
  "resolved",
  "suppressed",
  "false_positive"
] as const;

export interface RepositoryCodebaseScanSummary {
  latestScanRunId: string | null;
  latestScanStatus: CodebaseScanStatus | null;
  latestScanTrigger: CodebaseScanTrigger | null;
  latestScanCommitSha: string | null;
  latestScanStartedAt: string | null;
  latestScanFinishedAt: string | null;
  latestScanCreatedAt: string | null;
  openCodebaseFindingsCount: number;
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
  openCodebaseFindingsCount?: number;
  lastReview: RepositoryLastReview | null;
  codebaseScan?: RepositoryCodebaseScanSummary;
  updatedAt: string;
}

export interface RepositoryListResponse {
  repositories: RepositoryListItem[];
  filters: DashboardRepositoryListFilters;
}

export interface RepositoryPullRequestSummary {
  id: string;
  number: number;
  title: string;
  authorLogin: string;
  baseRef: string;
  headRef: string;
  state: string;
  draft: boolean;
  latestReviewRun: RepositoryLastReview | null;
  updatedAt: string;
}

export type RepositoryActivityKind =
  | "repository_synced"
  | "configuration_updated"
  | "pull_request_seen"
  | "review_run_updated"
  | "finding_created"
  | "codebase_scan_updated"
  | "codebase_finding_updated";

export interface RepositoryActivityItem {
  id: string;
  kind: RepositoryActivityKind;
  title: string;
  detail: string;
  createdAt: string;
}

export interface RepositoryDetailPermissions {
  canManageConfiguration: boolean;
  canRetryReviewRuns: boolean;
  canAccessRawArtifacts: boolean;
  canTriggerCodebaseScans?: boolean;
  canManageCodebaseScans?: boolean;
}

export interface RepositoryDetailResponse {
  repository: RepositoryListItem;
  configuration: RepositoryReviewConfiguration;
  pullRequests: RepositoryPullRequestSummary[];
  reviewRuns: ReviewRunListItem[];
  findings: FindingInboxItem[];
  codebaseScans?: CodebaseScanRunListItem[];
  codebaseFindings?: CodebaseScanFindingInboxItem[];
  activity: RepositoryActivityItem[];
  permissions: RepositoryDetailPermissions;
}

export interface RepositoryActivityResponse {
  repositoryId: string;
  activity: RepositoryActivityItem[];
}

export interface CodebaseScanEnqueueResponse {
  scanRunId: string;
  jobId: string | null;
  repositoryId: string;
  repositoryFullName: string;
  trigger: "install" | "scheduled" | "manual" | "push";
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "superseded";
  commitSha: string | null;
  correlationId: string;
  created: boolean;
  duplicate: boolean;
}

export interface CodebaseScanArtifactMetadataItem {
  artifactType: "semgrep" | "tree_sitter" | "context_pack" | "llm_raw" | "scan_summary";
  storageKey: string;
  sizeBytes: number;
  sha256: string;
  redacted: boolean;
  retentionExpiresAt: string;
  metadata: Record<string, unknown>;
}

export interface CodebaseScanRunListItem {
  id: string;
  repositoryId: string;
  repositoryFullName: string;
  trigger: CodebaseScanTrigger;
  defaultBranch: string;
  commitSha: string | null;
  status: CodebaseScanStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  findingsCount: number;
  openFindingsCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CodebaseScanRunListFilters {
  status?: CodebaseScanStatus;
  trigger?: CodebaseScanTrigger;
  dateFrom?: string;
  dateTo?: string;
}

export interface CodebaseScanRunListResponse {
  repositoryId: string;
  codebaseScans: CodebaseScanRunListItem[];
  filters: CodebaseScanRunListFilters;
}

export interface CodebaseScanRunDetailResponse extends CodebaseScanRunListItem {
  metrics: Record<string, unknown>;
  artifacts: CodebaseScanArtifactMetadataItem[];
  findings: CodebaseScanFindingInboxItem[];
  permissions: {
    canManageCodebaseFindings: boolean;
  };
}

export interface GitHubOAuthUserSummary {
  githubUserId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  connectedAt: string;
  updatedAt: string;
}

export interface GitHubOAuthStatusResponse {
  connected: boolean;
  user: GitHubOAuthUserSummary | null;
}

export interface GitHubOAuthStartResponse {
  authorizationUrl: string;
  expiresAt: string;
}

export interface GitHubInstallationListItem {
  id: string;
  installationId: number;
  accountLogin: string | null;
  accountType: string | null;
  repositoryCount: number;
  enabledRepositoryCount: number;
  updatedAt: string;
}

export interface GitHubInstallationListResponse {
  installations: GitHubInstallationListItem[];
}

export interface GitHubInstallationSyncResponse {
  installations: GitHubInstallationListItem[];
  syncedRepositoryCount: number;
}

export interface GitHubRepositorySyncResponse {
  repository: RepositoryListItem;
}

export const DASHBOARD_WORKSPACE_ROLES = ["owner", "admin", "developer", "viewer"] as const;

export type DashboardWorkspaceRole = (typeof DASHBOARD_WORKSPACE_ROLES)[number];

export function canManageSensitiveWorkspaceSettings(role: DashboardWorkspaceRole): boolean {
  return role === "admin";
}

export function canRetryReviewRuns(role: DashboardWorkspaceRole): boolean {
  return role === "owner" || role === "admin" || role === "developer";
}

export function canManageRepositoryConfiguration(role: DashboardWorkspaceRole): boolean {
  return role === "admin" || role === "developer";
}

export function canTriggerCodebaseScans(role: DashboardWorkspaceRole): boolean {
  return role === "owner" || role === "admin" || role === "developer";
}

export function canManageCodebaseScans(role: DashboardWorkspaceRole): boolean {
  return role === "owner" || role === "admin" || role === "developer";
}

export function canAccessRawReviewArtifacts(role: DashboardWorkspaceRole): boolean {
  return role === "admin";
}

export function canManageBilling(role: DashboardWorkspaceRole, hasClerkBillingCapability = false): boolean {
  return role === "admin" || hasClerkBillingCapability;
}

export const REPOSITORY_REVIEW_SEVERITY_THRESHOLDS = ["info", "low", "medium", "high", "critical"] as const;

export type RepositoryReviewSeverityThreshold = (typeof REPOSITORY_REVIEW_SEVERITY_THRESHOLDS)[number];

export interface RepositoryReviewConfiguration {
  repositoryId: string;
  automationEnabled: boolean;
  codebaseScanEnabled?: boolean;
  codebaseScanCadenceHours?: number;
  codebaseScanIgnoredPaths?: string[];
  codebaseScanSeverityThreshold?: RepositoryReviewSeverityThreshold;
  codebaseScanMaxFiles?: number;
  codebaseScanMaxBytes?: number;
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
    | "codebaseScanEnabled"
    | "codebaseScanCadenceHours"
    | "codebaseScanIgnoredPaths"
    | "codebaseScanSeverityThreshold"
    | "codebaseScanMaxFiles"
    | "codebaseScanMaxBytes"
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

export type ReviewPolicyScope = "workspace" | "repository";

export interface ReviewPolicyReviewPreferences {
  reviewDraftPullRequests: boolean;
  requireTestsForRiskyChanges: boolean;
  suggestMissingTests: boolean;
}

export interface ReviewPolicyCommentPolicy {
  maxInlineComments: number;
  severityThreshold: RepositoryReviewSeverityThreshold;
}

export type ReviewPolicyCategoryEnablement = Record<ReviewFindingCategory, boolean>;

export interface ReviewPolicySemgrepSettings {
  enabled: boolean;
  includeInfrastructureRules: boolean;
  scanGeneratedFilesForSecrets: boolean;
}

export interface ReviewPolicyAnalysisToggles {
  treeSitterEnabled: boolean;
  llmReviewEnabled: boolean;
  ciExplanationEnabled: boolean;
}

export interface ReviewPolicyInfrastructureSecurity {
  infrastructureReviewEnabled: boolean;
  securityReviewEnabled: boolean;
  dependencyReviewEnabled: boolean;
  ciWorkflowReviewEnabled: boolean;
}

export interface ReviewPolicyWorkspaceControls {
  globalWorkspacePolicyEnabled: boolean;
  retentionDays: number;
  apiKeyCreationEnabled: boolean;
  billingChangesRequireAdmin: boolean;
  supportSafetyOverridesEnabled: boolean;
}

export interface ReviewPolicy {
  workspaceId: string;
  repositoryId: string | null;
  scope: ReviewPolicyScope;
  reviewPreferences: ReviewPolicyReviewPreferences;
  commentPolicy: ReviewPolicyCommentPolicy;
  categories: ReviewPolicyCategoryEnablement;
  promptInstructions: string;
  ignoredPaths: string[];
  generatedFileIgnorePatterns: string[];
  semgrep: ReviewPolicySemgrepSettings;
  analysis: ReviewPolicyAnalysisToggles;
  infrastructureSecurity: ReviewPolicyInfrastructureSecurity;
  workspaceControls: ReviewPolicyWorkspaceControls;
  updatedByClerkUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewPolicySummary {
  repositoryId: string;
  fullName: string;
  policy: ReviewPolicy;
}

export interface RulesPolicyResponse {
  workspacePolicy: ReviewPolicy;
  repositoryPolicies: ReviewPolicySummary[];
  selectedRepositoryPolicy: ReviewPolicy | null;
  permissions: {
    canManagePolicies: boolean;
    canManageWorkspacePolicies?: boolean;
    canManageRepositoryPolicies?: boolean;
    canManageSensitiveWorkspacePolicies?: boolean;
  };
}

export interface UpdateReviewPolicyRequest {
  repositoryId?: string | null;
  reviewPreferences?: Partial<ReviewPolicyReviewPreferences>;
  commentPolicy?: Partial<ReviewPolicyCommentPolicy>;
  categories?: Partial<ReviewPolicyCategoryEnablement>;
  promptInstructions?: string;
  ignoredPaths?: string[];
  generatedFileIgnorePatterns?: string[];
  semgrep?: Partial<ReviewPolicySemgrepSettings>;
  analysis?: Partial<ReviewPolicyAnalysisToggles>;
  infrastructureSecurity?: Partial<ReviewPolicyInfrastructureSecurity>;
  workspaceControls?: Partial<ReviewPolicyWorkspaceControls>;
}

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

export const PULL_REQUEST_DASHBOARD_STATUSES = ["open", "closed", "merged", "draft"] as const;

export type PullRequestDashboardStatus = (typeof PULL_REQUEST_DASHBOARD_STATUSES)[number];

export interface PullRequestListFilters {
  repositoryId?: string;
  repository?: string;
  status?: PullRequestDashboardStatus;
  riskLevel?: ReviewRunRiskLevel;
  reviewStatus?: ReviewRunStatus;
  author?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface PullRequestLatestReview {
  reviewRunId: string;
  status: ReviewRunStatus;
  riskLevel: ReviewRunRiskLevel;
  findingsCount: number;
  changedFilesCount: number;
  durationMs: number | null;
  headSha: string;
  createdAt: string;
  finishedAt: string | null;
}

export interface PullRequestListItem {
  id: string;
  repositoryId: string;
  repositoryFullName: string;
  repositoryPrivate: boolean;
  number: number;
  title: string;
  authorLogin: string;
  status: PullRequestDashboardStatus;
  state: string;
  draft: boolean;
  baseRef: string;
  headRef: string;
  headSha: string;
  latestReview: PullRequestLatestReview | null;
  riskLevel: ReviewRunRiskLevel;
  reviewStatus: ReviewRunStatus | null;
  githubUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequestListResponse {
  pullRequests: PullRequestListItem[];
  filters: PullRequestListFilters;
  pagination: {
    limit: number;
    returned: number;
  };
}

export interface PullRequestRiskAnalysis {
  riskLevel: ReviewRunRiskLevel;
  riskFlags: string[];
  summary: string | null;
}

export interface PullRequestBranches {
  baseRef: string;
  headRef: string;
  baseSha: string;
  headSha: string;
}

export interface PullRequestDashboardFinding extends ReviewRunFinding {
  reviewRunId: string;
}

export interface PullRequestMetadata {
  repositoryId: string;
  repositoryFullName: string;
  repositoryPrivate: boolean;
  reviewRunsCount: number;
  findingsCount: number;
  changedFilesCount: number;
  latestReviewStatus: ReviewRunStatus | null;
}

export interface PullRequestDetailResponse extends PullRequestListItem {
  summary: string | null;
  changedComponents: string[];
  riskAnalysis: PullRequestRiskAnalysis;
  reviewTimeline: ReviewRunListItem[];
  findings: PullRequestDashboardFinding[];
  metadata: PullRequestMetadata;
  branches: PullRequestBranches;
  commitSha: string;
  changedFiles: ReviewRunChangedFile[];
  durationMs: number | null;
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
export type FindingInboxSource = ReviewFindingSource | CodebaseScanFindingSource;
export type ReviewFindingCategory = "bug" | "security" | "performance" | "maintainability" | "test" | "infra" | "ci";
export type ReviewFindingSeverity = "info" | "low" | "medium" | "high" | "critical";
export type ReviewFindingConfidence = "low" | "medium" | "high";
export type ReviewFindingStatus = "open" | "posted" | "suppressed" | "resolved" | "false_positive";
export type FindingInboxType = "pull_request" | "codebase_scan";

export const REVIEW_FINDING_SOURCES: readonly ReviewFindingSource[] = ["semgrep", "llm", "ci", "policy"] as const;
export const FINDING_INBOX_SOURCES: readonly FindingInboxSource[] = [
  "semgrep",
  "llm",
  "tree_sitter",
  "ci",
  "policy"
] as const;
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
  source: FindingInboxSource;
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
  findingType?: FindingInboxType;
  severity?: ReviewFindingSeverity;
  source?: FindingInboxSource;
  category?: ReviewFindingCategory;
  repositoryId?: string;
  repository?: string;
  status?: ReviewFindingStatus;
  postedInline?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface FindingInboxItem extends ReviewRunFinding {
  findingType?: FindingInboxType;
  reviewRunId: string | null;
  scanRunId?: string | null;
  repositoryId: string;
  repositoryFullName: string;
  pullRequestNumber: number | null;
  pullRequestTitle: string | null;
  scanStatus?: CodebaseScanStatus | null;
  status: ReviewFindingStatus;
  semgrepRuleId: string | null;
  postedAt: string | null;
  githubCommentId: number | null;
  githubCommentUrl: string | null;
  reviewRunCreatedAt: string | null;
  scanRunCreatedAt?: string | null;
  statusUpdatedAt?: string | null;
}

export interface FindingsListResponse {
  findings: FindingInboxItem[];
  filters: FindingsListFilters;
  permissions?: {
    canManageCodebaseFindings: boolean;
  };
}

export interface CodebaseScanFindingInboxItem extends FindingInboxItem {
  findingType: "codebase_scan";
  reviewRunId: null;
  scanRunId: string;
  pullRequestNumber: null;
  pullRequestTitle: null;
  scanStatus: CodebaseScanStatus;
  status: CodebaseScanFindingStatus;
  suggestion: string | null;
  postAsInline: false;
  postedInline: false;
  postedAt: null;
  githubCommentId: null;
  githubCommentUrl: null;
  reviewRunCreatedAt: null;
  scanRunCreatedAt: string;
}

export interface CodebaseScanFindingListFilters {
  repositoryId?: string;
  repository?: string;
  severity?: ReviewFindingSeverity;
  source?: CodebaseScanFindingSource;
  category?: ReviewFindingCategory;
  status?: CodebaseScanFindingStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface CodebaseScanFindingListResponse {
  findings: CodebaseScanFindingInboxItem[];
  filters: CodebaseScanFindingListFilters;
  permissions: {
    canManageCodebaseFindings: boolean;
  };
}

export interface UpdateCodebaseScanFindingStatusRequest {
  status: CodebaseScanFindingStatus;
  reason?: string | null;
}

export interface WorkspaceSettingsInstallation {
  id: string;
  installationId: number;
  accountLogin: string | null;
  accountType: string | null;
  repositoryCount: number;
  enabledRepositoryCount: number;
  updatedAt: string;
}

export interface WorkspaceSettingsMember {
  clerkUserId: string;
  role: DashboardWorkspaceRole;
  active: boolean;
  isCurrentUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateWorkspaceMemberRoleRequest {
  role: "admin" | "developer";
}

export interface UpdateWorkspaceMemberStatusRequest {
  active: boolean;
}

export interface WorkspaceRetentionPolicy {
  artifactRetentionDays: number;
  changedFilePatchDays: number;
  fullSnapshotDays: number;
  ciLogDays: number;
  llmArtifactDays: number;
  semgrepArtifactDays: number;
  treeSitterArtifactDays: number;
  findingMetadataDays: number;
  aggregatedMetricDays: number;
}

export interface WorkspaceSettingsResponse {
  workspace: {
    id: string;
    name: string;
    clerkOrgId: string | null;
    role: DashboardWorkspaceRole;
    canManageSensitiveSettings: boolean;
  };
  clerk: {
    userProfileUrl: string;
    organizationProfileUrl: string;
    memberManagementUrl: string;
  };
  githubApp: {
    installUrl: string;
    installations: WorkspaceSettingsInstallation[];
    repositoryConfigurationUrl: string;
  };
  members?: WorkspaceSettingsMember[];
  retention: WorkspaceRetentionPolicy;
  apiKeys: {
    enabled: boolean;
    message: string;
  };
  notifications: {
    enabled: boolean;
    message: string;
  };
}

export type ReviewRunArtifactType =
  | "diff"
  | "treesitter"
  | "semgrep"
  | "context_pack"
  | "llm_raw"
  | "ci_log"
  | "ci_failure_explanation";

export interface ReviewRunArtifact {
  id: string;
  artifactType: ReviewRunArtifactType;
  storageKey: string | null;
  metadata: Record<string, unknown>;
  rawAccessAllowed: boolean;
  rawAccessRequiredRole: "admin";
  rawAccessUrl: string | null;
  createdAt: string;
}

export interface RawReviewRunArtifactAccess {
  reviewRunId: string;
  artifactId: string;
  artifactType: ReviewRunArtifactType;
  storageKey: string;
  metadata: Record<string, unknown>;
  rawAccessAllowed: true;
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
  permissions: {
    canRetryReviewRun: boolean;
    canAccessRawArtifacts: boolean;
  };
}

export interface CiFailureListFilters {
  repositoryId?: string;
  repository?: string;
  status?: ReviewRunStatus;
  flaky?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface CiFailureFailedJob {
  id: string;
  workflowName: string | null;
  jobName: string;
  checkRunId: number;
  conclusion: string;
  stepName: string | null;
  category: string;
  detailsUrl: string | null;
}

export interface CiFailureListItem {
  id: string;
  repositoryId: string;
  repositoryFullName: string;
  pullRequestId: string;
  pullRequestNumber: number;
  pullRequestTitle: string;
  reviewRunId: string;
  failedJob: CiFailureFailedJob;
  rootCauseSummary: string;
  flakySuspected: boolean;
  suggestedFix: string | null;
  status: ReviewRunStatus;
  createdAt: string;
}

export interface CiFailureListResponse {
  ciFailures: CiFailureListItem[];
  filters: CiFailureListFilters;
  pagination: {
    limit: number;
    returned: number;
  };
}

export interface CiFailureSuggestedFix {
  id: string;
  text: string;
}

export interface CiFailureRelatedReviewRun {
  id: string;
  status: ReviewRunStatus;
  createdAt: string;
  detailUrl: string;
}

export interface CiFailureDetailResponse extends CiFailureListItem {
  rootCause: string;
  suggestedFixes: CiFailureSuggestedFix[];
  failedJobs: CiFailureFailedJob[];
  relatedReviewRun: CiFailureRelatedReviewRun;
  relatedArtifacts: ReviewRunArtifact[];
  logExcerpts: Array<ReviewRunLogExcerpt & { collapsed: true }>;
  unavailableLogNotes: unknown[];
}

export interface WorkspaceBillingResponse {
  workspace: {
    id: string;
    role: DashboardWorkspaceRole;
    canManageBilling: boolean;
    source: "clerk";
  };
  plan: {
    name: string;
    status: "managed_by_clerk";
  };
  usage: {
    reviewRunsThisMonth: number | null;
    aiTokensThisMonth: number | null;
    repositoriesMonitored: number | null;
    seats: number | null;
  };
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
