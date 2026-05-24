import type {
  PullRequestDashboardFinding,
  PullRequestDetailResponse,
  PullRequestLatestReview,
  PullRequestListFilters,
  PullRequestListItem,
  PullRequestListResponse,
  PullRequestMetadata,
  PullRequestRiskAnalysis,
  ReviewFindingCategory,
  ReviewFindingConfidence,
  ReviewFindingSeverity,
  ReviewFindingSource,
  ReviewRunChangedFile,
  ReviewRunListItem,
  ReviewRunRiskLevel,
  ReviewRunStatus
} from "@firmcode/shared";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const PULL_REQUESTS_STORE = Symbol("PULL_REQUESTS_STORE");

export interface PullRequestsStore {
  listPullRequests(input: PullRequestListInput): Promise<PullRequestListResponse>;
  getPullRequestDetail(input: PullRequestDetailLookup): Promise<PullRequestDetailResponse | null>;
}

export interface PullRequestListInput {
  readonly workspaceId: string;
  readonly filters: PullRequestListFilters;
}

export interface PullRequestDetailLookup {
  readonly workspaceId: string;
  readonly pullRequestId: string;
}

interface PullRequestRow {
  readonly id: string;
  readonly repository_id: string;
  readonly repository_full_name: string;
  readonly repository_private: boolean;
  readonly number: number;
  readonly title: string;
  readonly author_login: string;
  readonly base_ref: string;
  readonly head_ref: string;
  readonly base_sha: string;
  readonly head_sha: string;
  readonly state: string;
  readonly draft: boolean;
  readonly created_at: Date | string | null;
  readonly updated_at: Date | string | null;
}

interface ReviewRunRow {
  readonly id: string;
  readonly repository_id: string;
  readonly pull_request_id: string;
  readonly repository_full_name: string;
  readonly pull_request_number: number;
  readonly pull_request_title: string;
  readonly pull_request_author: string;
  readonly trigger_event: string;
  readonly head_sha: string;
  readonly status: ReviewRunStatus;
  readonly started_at: Date | string | null;
  readonly finished_at: Date | string | null;
  readonly metrics_json: unknown;
  readonly created_at: Date | string | null;
  readonly updated_at: Date | string | null;
}

interface CountRow {
  readonly review_run_id: string;
  readonly count: string | number;
}

interface ChangedFileRow {
  readonly id: string;
  readonly review_run_id: string;
  readonly path: string;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
  readonly language: string | null;
  readonly is_infrastructure: boolean;
  readonly is_supported: boolean;
  readonly risk_flags_json: unknown;
  readonly created_at: Date | string | null;
}

interface FindingRow {
  readonly id: string;
  readonly review_run_id: string;
  readonly source: ReviewFindingSource;
  readonly category: ReviewFindingCategory;
  readonly severity: ReviewFindingSeverity;
  readonly confidence: ReviewFindingConfidence;
  readonly file_path: string | null;
  readonly start_line: number | null;
  readonly end_line: number | null;
  readonly title: string;
  readonly body: string;
  readonly evidence_json: unknown;
  readonly suggestion: string | null;
  readonly dedupe_key: string;
  readonly post_as_inline: boolean;
  readonly created_at: Date | string | null;
  readonly posted_at: Date | string | null;
}

interface SummaryCommentRow {
  readonly body: string | null;
}

interface ReviewRunCounts {
  findingsCount: number;
  changedFilesCount: number;
  commentsPostedCount: number;
}

export class EmptyPullRequestsStore implements PullRequestsStore {
  async listPullRequests(input: PullRequestListInput): Promise<PullRequestListResponse> {
    return {
      pullRequests: [],
      filters: input.filters,
      pagination: {
        limit: input.filters.limit ?? DEFAULT_PULL_REQUEST_LIMIT,
        returned: 0
      }
    };
  }

  async getPullRequestDetail(_input: PullRequestDetailLookup): Promise<PullRequestDetailResponse | null> {
    return null;
  }
}

export class PostgresPullRequestsStore implements PullRequestsStore {
  constructor(private readonly database: DatabaseExecutor) {}

  async listPullRequests(input: PullRequestListInput): Promise<PullRequestListResponse> {
    const filters = input.filters;
    const limit = filters.limit ?? DEFAULT_PULL_REQUEST_LIMIT;
    const { whereSql, values } = buildPullRequestWhereClause(input.workspaceId, filters);
    const pullRequestsResult = await this.database.query<PullRequestRow>(
      `
SELECT
  pr.id,
  pr.repository_id,
  r.full_name AS repository_full_name,
  r.private AS repository_private,
  pr.number,
  pr.title,
  pr.author_login,
  pr.base_ref,
  pr.head_ref,
  pr.base_sha,
  pr.head_sha,
  pr.state,
  pr.draft,
  pr.created_at,
  pr.updated_at
FROM pull_requests pr
JOIN repositories r ON r.id = pr.repository_id
JOIN github_installations gi ON gi.id = r.installation_id
${whereSql}
ORDER BY pr.updated_at DESC, pr.number DESC
LIMIT 500
`,
      values
    );
    const [reviewRuns, counts, changedFiles] = await Promise.all([
      this.loadWorkspaceReviewRuns(input.workspaceId),
      this.loadWorkspaceReviewRunCounts(input.workspaceId),
      this.loadWorkspaceChangedFiles(input.workspaceId)
    ]);
    const latestRunsByPullRequestId = firstReviewRunByPullRequestId(reviewRuns);

    const pullRequests = pullRequestsResult.rows
      .map((row) => toPullRequestListItem(row, latestRunsByPullRequestId.get(row.id) ?? null, counts, changedFiles))
      .filter((pullRequest) => matchesPostQueryFilters(pullRequest, filters))
      .slice(0, limit);

    return {
      pullRequests,
      filters,
      pagination: {
        limit,
        returned: pullRequests.length
      }
    };
  }

  async getPullRequestDetail(input: PullRequestDetailLookup): Promise<PullRequestDetailResponse | null> {
    const pullRequestResult = await this.database.query<PullRequestRow>(
      `
SELECT
  pr.id,
  pr.repository_id,
  r.full_name AS repository_full_name,
  r.private AS repository_private,
  pr.number,
  pr.title,
  pr.author_login,
  pr.base_ref,
  pr.head_ref,
  pr.base_sha,
  pr.head_sha,
  pr.state,
  pr.draft,
  pr.created_at,
  pr.updated_at
FROM pull_requests pr
JOIN repositories r ON r.id = pr.repository_id
JOIN github_installations gi ON gi.id = r.installation_id
WHERE pr.id = $1
  AND gi.workspace_id = $2
`,
      [input.pullRequestId, input.workspaceId]
    );
    const pullRequest = pullRequestResult.rows[0];

    if (pullRequest === undefined) {
      return null;
    }

    const [reviewRuns, counts, changedFiles, findings, summary] = await Promise.all([
      this.loadPullRequestReviewRuns(input.pullRequestId),
      this.loadPullRequestReviewRunCounts(input.pullRequestId),
      this.loadPullRequestChangedFiles(input.pullRequestId),
      this.loadPullRequestFindings(input.pullRequestId),
      this.loadLatestSummary(input.pullRequestId)
    ]);
    const latestRun = reviewRuns[0] ?? null;
    const changedFilesForLatestRun = latestRun === null ? [] : changedFiles.filter((file) => file.review_run_id === latestRun.id);
    const listItem = toPullRequestListItem(
      pullRequest,
      latestRun,
      counts,
      groupChangedFilesByReviewRun(changedFiles)
    );
    const reviewTimeline = reviewRuns.map((run) => toReviewRunListItem(run, counts, changedFiles));
    const riskAnalysis = buildRiskAnalysis(latestRun, changedFilesForLatestRun);
    const detailFindings = findings.map(toPullRequestFinding);
    const changedFileDtos = changedFilesForLatestRun.map(toChangedFile);
    const metadata: PullRequestMetadata = {
      repositoryId: pullRequest.repository_id,
      repositoryFullName: pullRequest.repository_full_name,
      repositoryPrivate: pullRequest.repository_private,
      reviewRunsCount: reviewRuns.length,
      findingsCount: detailFindings.length,
      changedFilesCount: changedFileDtos.length,
      latestReviewStatus: latestRun?.status ?? null
    };

    return {
      ...listItem,
      summary: summary ?? readStringMetric(latestRun, "summary"),
      changedComponents: deriveChangedComponents(latestRun, changedFilesForLatestRun),
      riskAnalysis,
      reviewTimeline,
      findings: detailFindings,
      metadata,
      branches: {
        baseRef: pullRequest.base_ref,
        headRef: pullRequest.head_ref,
        baseSha: pullRequest.base_sha,
        headSha: pullRequest.head_sha
      },
      commitSha: pullRequest.head_sha,
      changedFiles: changedFileDtos,
      durationMs: latestRun === null ? null : deriveDurationMs(latestRun.started_at, latestRun.finished_at, normalizeJsonObject(latestRun.metrics_json))
    };
  }

  private async loadWorkspaceReviewRuns(workspaceId: string): Promise<ReviewRunRow[]> {
    const result = await this.database.query<ReviewRunRow>(
      `
SELECT
  rr.id,
  rr.repository_id,
  rr.pull_request_id,
  r.full_name AS repository_full_name,
  pr.number AS pull_request_number,
  pr.title AS pull_request_title,
  pr.author_login AS pull_request_author,
  rr.trigger_event,
  rr.head_sha,
  rr.status,
  rr.started_at,
  rr.finished_at,
  rr.metrics_json,
  rr.created_at,
  rr.updated_at
FROM review_runs rr
JOIN repositories r ON r.id = rr.repository_id
JOIN github_installations gi ON gi.id = r.installation_id
JOIN pull_requests pr ON pr.id = rr.pull_request_id
WHERE gi.workspace_id = $1
ORDER BY rr.created_at DESC
`,
      [workspaceId]
    );

    return result.rows;
  }

  private async loadPullRequestReviewRuns(pullRequestId: string): Promise<ReviewRunRow[]> {
    const result = await this.database.query<ReviewRunRow>(
      `
SELECT
  rr.id,
  rr.repository_id,
  rr.pull_request_id,
  r.full_name AS repository_full_name,
  pr.number AS pull_request_number,
  pr.title AS pull_request_title,
  pr.author_login AS pull_request_author,
  rr.trigger_event,
  rr.head_sha,
  rr.status,
  rr.started_at,
  rr.finished_at,
  rr.metrics_json,
  rr.created_at,
  rr.updated_at
FROM review_runs rr
JOIN repositories r ON r.id = rr.repository_id
JOIN pull_requests pr ON pr.id = rr.pull_request_id
WHERE rr.pull_request_id = $1
ORDER BY rr.created_at DESC
`,
      [pullRequestId]
    );

    return result.rows;
  }

  private async loadWorkspaceReviewRunCounts(workspaceId: string): Promise<Map<string, ReviewRunCounts>> {
    const [findings, comments, files] = await Promise.all([
      this.database.query<CountRow>(
        `
SELECT rr.id AS review_run_id, COUNT(f.id) AS count
FROM review_runs rr
JOIN repositories r ON r.id = rr.repository_id
JOIN github_installations gi ON gi.id = r.installation_id
LEFT JOIN findings f ON f.review_run_id = rr.id
WHERE gi.workspace_id = $1
GROUP BY rr.id
`,
        [workspaceId]
      ),
      this.database.query<CountRow>(
        `
SELECT rr.id AS review_run_id, COUNT(pc.id) AS count
FROM review_runs rr
JOIN repositories r ON r.id = rr.repository_id
JOIN github_installations gi ON gi.id = r.installation_id
LEFT JOIN published_comments pc ON pc.review_run_id = rr.id AND pc.comment_type = 'inline'
WHERE gi.workspace_id = $1
GROUP BY rr.id
`,
        [workspaceId]
      ),
      this.database.query<CountRow>(
        `
SELECT rr.id AS review_run_id, COUNT(cf.id) AS count
FROM review_runs rr
JOIN repositories r ON r.id = rr.repository_id
JOIN github_installations gi ON gi.id = r.installation_id
LEFT JOIN changed_files cf ON cf.review_run_id = rr.id
WHERE gi.workspace_id = $1
GROUP BY rr.id
`,
        [workspaceId]
      )
    ]);

    return buildCounts(findings.rows, comments.rows, files.rows);
  }

  private async loadPullRequestReviewRunCounts(pullRequestId: string): Promise<Map<string, ReviewRunCounts>> {
    const [findings, comments, files] = await Promise.all([
      this.database.query<CountRow>(
        `
SELECT rr.id AS review_run_id, COUNT(f.id) AS count
FROM review_runs rr
LEFT JOIN findings f ON f.review_run_id = rr.id
WHERE rr.pull_request_id = $1
GROUP BY rr.id
`,
        [pullRequestId]
      ),
      this.database.query<CountRow>(
        `
SELECT rr.id AS review_run_id, COUNT(pc.id) AS count
FROM review_runs rr
LEFT JOIN published_comments pc ON pc.review_run_id = rr.id AND pc.comment_type = 'inline'
WHERE rr.pull_request_id = $1
GROUP BY rr.id
`,
        [pullRequestId]
      ),
      this.database.query<CountRow>(
        `
SELECT rr.id AS review_run_id, COUNT(cf.id) AS count
FROM review_runs rr
LEFT JOIN changed_files cf ON cf.review_run_id = rr.id
WHERE rr.pull_request_id = $1
GROUP BY rr.id
`,
        [pullRequestId]
      )
    ]);

    return buildCounts(findings.rows, comments.rows, files.rows);
  }

  private async loadWorkspaceChangedFiles(workspaceId: string): Promise<Map<string, ChangedFileRow[]>> {
    const result = await this.database.query<ChangedFileRow>(
      `
SELECT
  cf.id,
  cf.review_run_id,
  cf.path,
  cf.status,
  cf.additions,
  cf.deletions,
  cf.language,
  cf.is_infrastructure,
  cf.is_supported,
  cf.risk_flags_json,
  cf.created_at
FROM changed_files cf
JOIN review_runs rr ON rr.id = cf.review_run_id
JOIN repositories r ON r.id = rr.repository_id
JOIN github_installations gi ON gi.id = r.installation_id
WHERE gi.workspace_id = $1
ORDER BY cf.path ASC
`,
      [workspaceId]
    );

    return groupChangedFilesByReviewRun(result.rows);
  }

  private async loadPullRequestChangedFiles(pullRequestId: string): Promise<ChangedFileRow[]> {
    const result = await this.database.query<ChangedFileRow>(
      `
SELECT
  cf.id,
  cf.review_run_id,
  cf.path,
  cf.status,
  cf.additions,
  cf.deletions,
  cf.language,
  cf.is_infrastructure,
  cf.is_supported,
  cf.risk_flags_json,
  cf.created_at
FROM changed_files cf
JOIN review_runs rr ON rr.id = cf.review_run_id
WHERE rr.pull_request_id = $1
ORDER BY cf.path ASC
`,
      [pullRequestId]
    );

    return result.rows;
  }

  private async loadPullRequestFindings(pullRequestId: string): Promise<FindingRow[]> {
    const result = await this.database.query<FindingRow>(
      `
SELECT
  f.id,
  f.review_run_id,
  f.source,
  f.category,
  f.severity,
  f.confidence,
  f.file_path,
  f.start_line,
  f.end_line,
  f.title,
  f.body,
  f.evidence_json,
  f.suggestion,
  f.dedupe_key,
  f.post_as_inline,
  f.created_at,
  pc.created_at AS posted_at
FROM findings f
JOIN review_runs rr ON rr.id = f.review_run_id
LEFT JOIN published_comments pc ON pc.finding_id = f.id AND pc.comment_type = 'inline'
WHERE rr.pull_request_id = $1
ORDER BY
  CASE f.severity
    WHEN 'critical' THEN 0
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
    ELSE 4
  END,
  f.created_at DESC
`,
      [pullRequestId]
    );

    return result.rows;
  }

  private async loadLatestSummary(pullRequestId: string): Promise<string | null> {
    const result = await this.database.query<SummaryCommentRow>(
      `
SELECT pc.body
FROM published_comments pc
JOIN review_runs rr ON rr.id = pc.review_run_id
WHERE rr.pull_request_id = $1
  AND pc.comment_type = 'summary'
  AND pc.body IS NOT NULL
ORDER BY pc.created_at DESC
LIMIT 1
`,
      [pullRequestId]
    );

    return result.rows[0]?.body ?? null;
  }
}

const DEFAULT_PULL_REQUEST_LIMIT = 50;

function buildPullRequestWhereClause(
  workspaceId: string,
  filters: PullRequestListFilters
): { whereSql: string; values: unknown[] } {
  const conditions = ["gi.workspace_id = $1"];
  const values: unknown[] = [workspaceId];

  if (filters.repositoryId !== undefined) {
    values.push(filters.repositoryId);
    conditions.push(`pr.repository_id = $${values.length}`);
  } else if (filters.repository !== undefined) {
    values.push(filters.repository);
    conditions.push(`lower(r.full_name) = lower($${values.length})`);
  }

  if (filters.status !== undefined) {
    if (filters.status === "draft") {
      conditions.push("pr.draft = true");
    } else {
      values.push(filters.status);
      conditions.push(`pr.state = $${values.length}`);
    }
  }

  if (filters.author !== undefined) {
    values.push(filters.author);
    conditions.push(`lower(pr.author_login) = lower($${values.length})`);
  }

  if (filters.dateFrom !== undefined) {
    values.push(filters.dateFrom);
    conditions.push(`pr.updated_at >= $${values.length}`);
  }

  if (filters.dateTo !== undefined) {
    values.push(filters.dateTo);
    conditions.push(`pr.updated_at <= $${values.length}`);
  }

  return {
    whereSql: `WHERE ${conditions.join(" AND ")}`,
    values
  };
}

function firstReviewRunByPullRequestId(reviewRuns: ReviewRunRow[]): Map<string, ReviewRunRow> {
  const latestRuns = new Map<string, ReviewRunRow>();

  for (const reviewRun of reviewRuns) {
    if (!latestRuns.has(reviewRun.pull_request_id)) {
      latestRuns.set(reviewRun.pull_request_id, reviewRun);
    }
  }

  return latestRuns;
}

function matchesPostQueryFilters(pullRequest: PullRequestListItem, filters: PullRequestListFilters): boolean {
  if (filters.riskLevel !== undefined && pullRequest.riskLevel !== filters.riskLevel) {
    return false;
  }

  if (filters.reviewStatus !== undefined && pullRequest.reviewStatus !== filters.reviewStatus) {
    return false;
  }

  return true;
}

function toPullRequestListItem(
  row: PullRequestRow,
  latestRun: ReviewRunRow | null,
  counts: ReadonlyMap<string, ReviewRunCounts>,
  changedFilesByReviewRunId: ReadonlyMap<string, ChangedFileRow[]>
): PullRequestListItem {
  const latestReview = latestRun === null ? null : toLatestReview(latestRun, counts, changedFilesByReviewRunId);
  const riskLevel = latestReview?.riskLevel ?? "unknown";

  return {
    id: row.id,
    repositoryId: row.repository_id,
    repositoryFullName: row.repository_full_name,
    repositoryPrivate: row.repository_private,
    number: row.number,
    title: row.title,
    authorLogin: row.author_login,
    status: toPullRequestStatus(row.state, row.draft),
    state: row.state,
    draft: row.draft,
    baseRef: row.base_ref,
    headRef: row.head_ref,
    headSha: row.head_sha,
    latestReview,
    riskLevel,
    reviewStatus: latestReview?.status ?? null,
    githubUrl: buildGitHubPullRequestUrl(row.repository_full_name, row.number),
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at)
  };
}

function toLatestReview(
  row: ReviewRunRow,
  counts: ReadonlyMap<string, ReviewRunCounts>,
  changedFilesByReviewRunId: ReadonlyMap<string, ChangedFileRow[]>
): PullRequestLatestReview {
  const metrics = normalizeJsonObject(row.metrics_json);
  const runCounts = counts.get(row.id) ?? emptyCounts();
  const changedFiles = changedFilesByReviewRunId.get(row.id) ?? [];

  return {
    reviewRunId: row.id,
    status: row.status,
    riskLevel: deriveRiskLevel(metrics, changedFiles),
    findingsCount: runCounts.findingsCount,
    changedFilesCount: runCounts.changedFilesCount,
    durationMs: deriveDurationMs(row.started_at, row.finished_at, metrics),
    headSha: row.head_sha,
    createdAt: toRequiredIsoString(row.created_at),
    finishedAt: toIsoString(row.finished_at)
  };
}

function toReviewRunListItem(
  row: ReviewRunRow,
  counts: ReadonlyMap<string, ReviewRunCounts>,
  changedFiles: ChangedFileRow[]
): ReviewRunListItem {
  const metrics = normalizeJsonObject(row.metrics_json);
  const runCounts = counts.get(row.id) ?? emptyCounts();
  const runChangedFiles = changedFiles.filter((file) => file.review_run_id === row.id);

  return {
    id: row.id,
    repositoryId: row.repository_id,
    pullRequestId: row.pull_request_id,
    repositoryFullName: row.repository_full_name,
    pullRequestNumber: row.pull_request_number,
    pullRequestTitle: row.pull_request_title,
    pullRequestAuthor: row.pull_request_author,
    triggerEvent: row.trigger_event,
    headSha: row.head_sha,
    status: row.status,
    findingsCount: runCounts.findingsCount,
    commentsPostedCount: runCounts.commentsPostedCount,
    filesAnalyzedCount: runChangedFiles.filter((file) => file.is_supported).length,
    currentStage: deriveCurrentStage(metrics, row.status),
    durationMs: deriveDurationMs(row.started_at, row.finished_at, metrics),
    riskLevel: deriveRiskLevel(metrics, runChangedFiles),
    startedAt: toIsoString(row.started_at),
    finishedAt: toIsoString(row.finished_at),
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at)
  };
}

function toChangedFile(row: ChangedFileRow): ReviewRunChangedFile {
  return {
    id: row.id,
    path: row.path,
    status: row.status,
    additions: row.additions,
    deletions: row.deletions,
    language: row.language,
    isInfrastructure: row.is_infrastructure,
    isSupported: row.is_supported,
    riskFlags: normalizeStringArray(row.risk_flags_json),
    createdAt: toRequiredIsoString(row.created_at)
  };
}

function toPullRequestFinding(row: FindingRow): PullRequestDashboardFinding {
  return {
    id: row.id,
    reviewRunId: row.review_run_id,
    source: row.source,
    category: row.category,
    severity: row.severity,
    confidence: row.confidence,
    filePath: row.file_path,
    startLine: row.start_line,
    endLine: row.end_line,
    title: row.title,
    body: row.body,
    evidence: Array.isArray(row.evidence_json) ? row.evidence_json : [],
    suggestion: row.suggestion,
    dedupeKey: row.dedupe_key,
    postAsInline: row.post_as_inline,
    postedInline: row.posted_at !== null,
    createdAt: toRequiredIsoString(row.created_at)
  };
}

function buildRiskAnalysis(latestRun: ReviewRunRow | null, changedFiles: ChangedFileRow[]): PullRequestRiskAnalysis {
  const metrics = latestRun === null ? {} : normalizeJsonObject(latestRun.metrics_json);
  const riskFlags = uniqueStrings(changedFiles.flatMap((file) => normalizeStringArray(file.risk_flags_json)));

  return {
    riskLevel: deriveRiskLevel(metrics, changedFiles),
    riskFlags,
    summary: readStringMetric(latestRun, "riskAnalysis") ?? readStringMetric(latestRun, "riskSummary")
  };
}

function deriveChangedComponents(latestRun: ReviewRunRow | null, changedFiles: ChangedFileRow[]): string[] {
  const metrics = latestRun === null ? {} : normalizeJsonObject(latestRun.metrics_json);
  const metricComponents = metrics.changedComponents;

  if (Array.isArray(metricComponents)) {
    return uniqueStrings(metricComponents.filter((item): item is string => typeof item === "string" && item.length > 0));
  }

  return uniqueStrings(
    changedFiles.map((file) => {
      const [first, second] = file.path.split("/");
      return second === undefined ? first : `${first}/${second}`;
    })
  );
}

function deriveRiskLevel(metrics: Record<string, unknown>, changedFiles: ChangedFileRow[]): ReviewRunRiskLevel {
  if (metrics.riskLevel === "low" || metrics.riskLevel === "medium" || metrics.riskLevel === "high") {
    return metrics.riskLevel;
  }

  if (changedFiles.some((file) => normalizeStringArray(file.risk_flags_json).some((flag) => HIGH_RISK_FLAGS.has(flag)))) {
    return "high";
  }

  if (changedFiles.some((file) => file.is_infrastructure || normalizeStringArray(file.risk_flags_json).length > 0)) {
    return "medium";
  }

  return changedFiles.length > 0 ? "low" : "unknown";
}

const HIGH_RISK_FLAGS = new Set(["auth", "secrets", "infra", "migration"]);

function buildCounts(
  findingRows: CountRow[],
  commentRows: CountRow[],
  changedFileRows: CountRow[]
): Map<string, ReviewRunCounts> {
  const counts = new Map<string, ReviewRunCounts>();

  for (const row of findingRows) {
    ensureCounts(counts, row.review_run_id).findingsCount = Number(row.count);
  }

  for (const row of commentRows) {
    ensureCounts(counts, row.review_run_id).commentsPostedCount = Number(row.count);
  }

  for (const row of changedFileRows) {
    ensureCounts(counts, row.review_run_id).changedFilesCount = Number(row.count);
  }

  return counts;
}

function ensureCounts(counts: Map<string, ReviewRunCounts>, reviewRunId: string): ReviewRunCounts {
  const existing = counts.get(reviewRunId);

  if (existing !== undefined) {
    return existing;
  }

  const created = emptyCounts();
  counts.set(reviewRunId, created);

  return created;
}

function emptyCounts(): ReviewRunCounts {
  return {
    findingsCount: 0,
    changedFilesCount: 0,
    commentsPostedCount: 0
  };
}

function groupChangedFilesByReviewRun(rows: ChangedFileRow[]): Map<string, ChangedFileRow[]> {
  const byReviewRun = new Map<string, ChangedFileRow[]>();

  for (const row of rows) {
    const existing = byReviewRun.get(row.review_run_id);

    if (existing === undefined) {
      byReviewRun.set(row.review_run_id, [row]);
    } else {
      existing.push(row);
    }
  }

  return byReviewRun;
}

function toPullRequestStatus(state: string, draft: boolean): PullRequestListItem["status"] {
  if (draft) {
    return "draft";
  }

  return state === "closed" || state === "merged" ? state : "open";
}

function deriveCurrentStage(metrics: Record<string, unknown>, status: ReviewRunStatus): string {
  if (typeof metrics.currentStage === "string" && metrics.currentStage.length > 0) {
    return metrics.currentStage;
  }

  if (status === "queued") {
    return "Webhook Received";
  }

  if (status === "running") {
    return "Review pipeline";
  }

  return status === "succeeded" ? "Comments Published" : "Review stopped";
}

function deriveDurationMs(
  startedAt: Date | string | null,
  finishedAt: Date | string | null,
  metrics: Record<string, unknown>
): number | null {
  const metricDuration = readNullableNumberMetric(metrics, "durationMs");

  if (metricDuration !== null) {
    return metricDuration;
  }

  if (startedAt === null || finishedAt === null) {
    return null;
  }

  return new Date(finishedAt).getTime() - new Date(startedAt).getTime();
}

function readNullableNumberMetric(metrics: Record<string, unknown>, key: string): number | null {
  const value = metrics[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringMetric(row: ReviewRunRow | null, key: string): string | null {
  if (row === null) {
    return null;
  }

  const metrics = normalizeJsonObject(row.metrics_json);
  const value = metrics[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

function buildGitHubPullRequestUrl(repositoryFullName: string, pullRequestNumber: number): string {
  return `https://github.com/${repositoryFullName}/pull/${pullRequestNumber}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toIsoString(value: Date | string | null): string | null {
  return value === null ? null : toRequiredIsoString(value);
}

function toRequiredIsoString(value: Date | string | null): string {
  if (value === null) {
    return new Date(0).toISOString();
  }

  return typeof value === "string" ? new Date(value).toISOString() : value.toISOString();
}
