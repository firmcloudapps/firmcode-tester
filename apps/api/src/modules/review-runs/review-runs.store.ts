import type {
  ReviewFindingCategory,
  ReviewFindingConfidence,
  ReviewFindingSeverity,
  ReviewFindingSource,
  ReviewPipelineStage,
  ReviewPipelineStageStatus,
  ReviewRunArtifact,
  ReviewRunArtifactType,
  ReviewRunChangedFile,
  ReviewRunDetail,
  ReviewRunFinding,
  ReviewRunListFilters,
  ReviewRunListItem,
  ReviewRunListResponse,
  ReviewRunLogExcerpt,
  ReviewRunPublishedComment,
  ReviewRunRiskLevel,
  ReviewRunStatus
} from "@firmcode/shared";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const REVIEW_RUNS_STORE = Symbol("REVIEW_RUNS_STORE");

export interface ReviewRunsStore {
  listReviewRuns(filters: ReviewRunListFilters): Promise<ReviewRunListResponse>;
  getReviewRunDetail(reviewRunId: string): Promise<ReviewRunDetail | null>;
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
  readonly started_at: Date | null;
  readonly finished_at: Date | null;
  readonly error_code: string | null;
  readonly error_message: string | null;
  readonly metrics_json: Record<string, unknown>;
  readonly created_at: Date | string | null;
  readonly updated_at: Date | string | null;
}

interface ReviewRunIdRow {
  readonly review_run_id: string;
}

interface ChangedFileRow {
  readonly id: string;
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
}

interface ArtifactRow {
  readonly id: string;
  readonly artifact_type: ReviewRunArtifactType;
  readonly storage_key: string;
  readonly metadata_json: unknown;
  readonly created_at: Date | string | null;
}

interface PublishedCommentRow {
  readonly id: string;
  readonly finding_id: string | null;
  readonly github_comment_id: string | number | null;
  readonly github_review_id: string | number | null;
  readonly comment_type: "summary" | "inline" | "review";
  readonly file_path: string | null;
  readonly line: number | null;
  readonly body: string | null;
  readonly body_hash: string;
  readonly dry_run: boolean;
  readonly created_at: Date | string | null;
}

export class EmptyReviewRunsStore implements ReviewRunsStore {
  async listReviewRuns(filters: ReviewRunListFilters): Promise<ReviewRunListResponse> {
    return { reviewRuns: [], filters };
  }

  async getReviewRunDetail(_reviewRunId: string): Promise<ReviewRunDetail | null> {
    return null;
  }
}

export class PostgresReviewRunsStore implements ReviewRunsStore {
  constructor(private readonly database: DatabaseExecutor) {}

  async listReviewRuns(filters: ReviewRunListFilters): Promise<ReviewRunListResponse> {
    const { whereSql, values } = buildReviewRunListWhereClause(filters);
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
  rr.error_code,
  rr.error_message,
  rr.metrics_json,
  rr.created_at,
  rr.updated_at
FROM review_runs rr
JOIN repositories r ON r.id = rr.repository_id
JOIN pull_requests pr ON pr.id = rr.pull_request_id
${whereSql}
ORDER BY rr.created_at DESC
LIMIT 100
`,
      values
    );
    const counts = await this.loadReviewRunCounts();

    const reviewRuns = result.rows.map((row) => toReviewRunListItem(row, counts)).filter((reviewRun) => {
      return filters.risk === undefined || reviewRun.riskLevel === filters.risk;
    });

    return {
      reviewRuns,
      filters
    };
  }

  async getReviewRunDetail(reviewRunId: string): Promise<ReviewRunDetail | null> {
    const runResult = await this.database.query<ReviewRunRow>(
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
  rr.error_code,
  rr.error_message,
  rr.metrics_json,
  rr.created_at,
  rr.updated_at
FROM review_runs rr
JOIN repositories r ON r.id = rr.repository_id
JOIN pull_requests pr ON pr.id = rr.pull_request_id
WHERE rr.id = $1
`,
      [reviewRunId]
    );
    const row = runResult.rows[0];

    if (row === undefined) {
      return null;
    }

    const changedFilesResult = await this.database.query<ChangedFileRow>(
      `
SELECT
  id,
  path,
  status,
  additions,
  deletions,
  language,
  is_infrastructure,
  is_supported,
  risk_flags_json,
  created_at
FROM changed_files
WHERE review_run_id = $1
ORDER BY path ASC
`,
      [reviewRunId]
    );
    const findingsResult = await this.database.query<FindingRow>(
      `
SELECT
  f.id,
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
  f.created_at
FROM findings f
WHERE f.review_run_id = $1
ORDER BY
  CASE f.severity
    WHEN 'critical' THEN 0
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
    ELSE 4
  END,
  f.created_at ASC
`,
      [reviewRunId]
    );
    const artifactsResult = await this.database.query<ArtifactRow>(
      `
SELECT
  id,
  artifact_type,
  storage_key,
  metadata_json,
  created_at
FROM analysis_artifacts
WHERE review_run_id = $1
ORDER BY created_at ASC, artifact_type ASC
`,
      [reviewRunId]
    );
    const commentsResult = await this.database.query<PublishedCommentRow>(
      `
SELECT
  id,
  finding_id,
  github_comment_id,
  github_review_id,
  comment_type,
  file_path,
  line,
  body,
  body_hash,
  dry_run,
  created_at
FROM published_comments
WHERE review_run_id = $1
ORDER BY created_at ASC,
  CASE comment_type WHEN 'summary' THEN 0 WHEN 'inline' THEN 1 ELSE 2 END,
  file_path ASC,
  line ASC
`,
      [reviewRunId]
    );
    const postedInlineFindingIds = new Set(
      commentsResult.rows
        .filter((comment) => comment.comment_type === "inline" && comment.finding_id !== null)
        .map((comment) => comment.finding_id as string)
    );
    const changedFiles = changedFilesResult.rows.map(toChangedFile);
    const findings = findingsResult.rows.map((finding) => toFinding(finding, postedInlineFindingIds));
    const artifacts = artifactsResult.rows.map(toArtifact);
    const publishedComments = commentsResult.rows.map(toPublishedComment);
    const metrics = normalizeJsonObject(row.metrics_json);
    const findingsBySource = countFindingsBySource(findings);

    return {
      id: row.id,
      repositoryId: row.repository_id,
      pullRequestId: row.pull_request_id,
      repositoryFullName: row.repository_full_name,
      pullRequestNumber: row.pull_request_number,
      pullRequestTitle: row.pull_request_title,
      triggerEvent: row.trigger_event,
      headSha: row.head_sha,
      status: row.status,
      startedAt: toIsoString(row.started_at),
      finishedAt: toIsoString(row.finished_at),
      errorCode: row.error_code,
      errorMessage: row.error_message,
      findingsCount: findings.length,
      metrics,
      durationMs: deriveDurationMs(row.started_at, row.finished_at, metrics),
      filesAnalyzedCount: changedFiles.filter((file) => file.isSupported).length,
      semgrepFindingsCount: findingsBySource.semgrep,
      aiFindingsCount: findingsBySource.llm,
      inlineCommentsPostedCount: publishedComments.filter((comment) => comment.commentType === "inline").length,
      tokenUsage: readNullableNumberMetric(metrics, "tokenUsage"),
      estimatedCostUsd: readNullableNumberMetric(metrics, "estimatedCostUsd"),
      riskLevel: deriveRiskLevel(metrics, changedFiles),
      pipelineStages: derivePipelineStages(row.status, row.error_message, metrics, artifacts, publishedComments),
      changedFiles,
      findings,
      artifacts,
      logExcerpts: deriveLogExcerpts(artifacts),
      createdAt: toRequiredIsoString(row.created_at),
      updatedAt: toRequiredIsoString(row.updated_at),
      publishedComments
    };
  }

  private async loadReviewRunCounts(): Promise<Map<string, ReviewRunCounts>> {
    const [findings, comments, changedFiles] = await Promise.all([
      this.database.query<ReviewRunIdRow>("SELECT review_run_id FROM findings"),
      this.database.query<ReviewRunIdRow>("SELECT review_run_id FROM published_comments WHERE comment_type = 'inline'"),
      this.database.query<ReviewRunIdRow>("SELECT review_run_id FROM changed_files WHERE is_supported = true")
    ]);
    const counts = new Map<string, ReviewRunCounts>();

    for (const row of findings.rows) {
      ensureReviewRunCounts(counts, row.review_run_id).findingsCount += 1;
    }

    for (const row of comments.rows) {
      ensureReviewRunCounts(counts, row.review_run_id).commentsPostedCount += 1;
    }

    for (const row of changedFiles.rows) {
      ensureReviewRunCounts(counts, row.review_run_id).filesAnalyzedCount += 1;
    }

    return counts;
  }
}

function buildReviewRunListWhereClause(filters: ReviewRunListFilters): { whereSql: string; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.status !== undefined) {
    values.push(filters.status);
    conditions.push(`rr.status = $${values.length}`);
  }

  if (filters.repositoryId !== undefined) {
    values.push(filters.repositoryId);
    conditions.push(`rr.repository_id = $${values.length}`);
  } else if (filters.repository !== undefined) {
    values.push(filters.repository);
    conditions.push(`lower(r.full_name) = lower($${values.length})`);
  }

  if (filters.triggerEvent !== undefined) {
    values.push(filters.triggerEvent);
    conditions.push(`rr.trigger_event = $${values.length}`);
  }

  if (filters.dateFrom !== undefined) {
    values.push(filters.dateFrom);
    conditions.push(`rr.created_at >= $${values.length}`);
  }

  if (filters.dateTo !== undefined) {
    values.push(filters.dateTo);
    conditions.push(`rr.created_at <= $${values.length}`);
  }

  return {
    whereSql: conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`,
    values
  };
}

interface ReviewRunCounts {
  findingsCount: number;
  commentsPostedCount: number;
  filesAnalyzedCount: number;
}

function ensureReviewRunCounts(counts: Map<string, ReviewRunCounts>, reviewRunId: string): ReviewRunCounts {
  const existing = counts.get(reviewRunId);

  if (existing !== undefined) {
    return existing;
  }

  const created = {
    findingsCount: 0,
    commentsPostedCount: 0,
    filesAnalyzedCount: 0
  };
  counts.set(reviewRunId, created);

  return created;
}

function toReviewRunListItem(row: ReviewRunRow, counts: Map<string, ReviewRunCounts>): ReviewRunListItem {
  const metrics = normalizeJsonObject(row.metrics_json);
  const rowCounts = counts.get(row.id) ?? {
    findingsCount: 0,
    commentsPostedCount: 0,
    filesAnalyzedCount: 0
  };

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
    findingsCount: rowCounts.findingsCount,
    commentsPostedCount: rowCounts.commentsPostedCount,
    filesAnalyzedCount: rowCounts.filesAnalyzedCount,
    currentStage: deriveCurrentStage(metrics, row.status),
    durationMs: deriveDurationMs(row.started_at, row.finished_at, metrics),
    riskLevel: deriveRiskLevel(metrics, []),
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

function toFinding(row: FindingRow, postedInlineFindingIds: ReadonlySet<string>): ReviewRunFinding {
  return {
    id: row.id,
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
    postedInline: postedInlineFindingIds.has(row.id),
    createdAt: toRequiredIsoString(row.created_at)
  };
}

function toArtifact(row: ArtifactRow): ReviewRunArtifact {
  return {
    id: row.id,
    artifactType: row.artifact_type,
    storageKey: row.storage_key,
    metadata: normalizeJsonObject(row.metadata_json),
    createdAt: toRequiredIsoString(row.created_at)
  };
}

function toPublishedComment(row: PublishedCommentRow): ReviewRunPublishedComment {
  return {
    id: row.id,
    commentType: row.comment_type,
    findingId: row.finding_id,
    githubCommentId: toNullableNumber(row.github_comment_id),
    githubReviewId: toNullableNumber(row.github_review_id),
    filePath: row.file_path,
    line: row.line,
    body: row.body,
    bodyHash: row.body_hash,
    dryRun: row.dry_run,
    createdAt: toRequiredIsoString(row.created_at)
  };
}

function countFindingsBySource(findings: ReviewRunFinding[]): Record<ReviewFindingSource, number> {
  return findings.reduce<Record<ReviewFindingSource, number>>(
    (counts, finding) => {
      counts[finding.source] += 1;
      return counts;
    },
    { semgrep: 0, llm: 0, ci: 0, policy: 0 }
  );
}

function derivePipelineStages(
  status: ReviewRunStatus,
  runErrorMessage: string | null,
  metrics: Record<string, unknown>,
  artifacts: ReviewRunArtifact[],
  publishedComments: ReviewRunPublishedComment[]
): ReviewPipelineStage[] {
  const explicitStages = metrics.pipelineStages;

  if (Array.isArray(explicitStages)) {
    const stages = explicitStages.map((stage, index) => toPipelineStage(stage, index)).filter(isNotNull);

    if (stages.length > 0) {
      return stages;
    }
  }

  const hasArtifact = (artifactType: ReviewRunArtifactType) =>
    artifacts.find((artifact) => artifact.artifactType === artifactType)?.id ?? null;
  const failed = status === "failed";

  return [
    makeDerivedPipelineStage("webhook_received", "Webhook Received", "succeeded", null, null),
    makeDerivedPipelineStage("diff_fetched", "Diff Fetched", stageStatusFromArtifact(hasArtifact("diff"), failed), hasArtifact("diff"), failed ? runErrorMessage : null),
    makeDerivedPipelineStage(
      "tree_sitter_parsed",
      "Tree-sitter Parsed",
      stageStatusFromArtifact(hasArtifact("treesitter"), failed),
      hasArtifact("treesitter"),
      null
    ),
    makeDerivedPipelineStage("semgrep_scanned", "Semgrep Scanned", stageStatusFromArtifact(hasArtifact("semgrep"), failed), hasArtifact("semgrep"), null),
    makeDerivedPipelineStage("llm_reviewed", "LLM Reviewed", stageStatusFromArtifact(hasArtifact("llm_raw"), failed), hasArtifact("llm_raw"), null),
    makeDerivedPipelineStage(
      "comments_published",
      "Comments Published",
      publishedComments.length > 0 ? "succeeded" : status === "succeeded" ? "skipped" : "pending",
      null,
      null
    )
  ];
}

function toPipelineStage(value: unknown, index: number): ReviewPipelineStage | null {
  if (!isRecord(value)) {
    return null;
  }

  const key = typeof value.key === "string" && value.key.length > 0 ? value.key : `stage_${index + 1}`;
  const label = typeof value.label === "string" && value.label.length > 0 ? value.label : key;
  const status = normalizePipelineStageStatus(value.status);

  return {
    key,
    label,
    status,
    durationMs: typeof value.durationMs === "number" && Number.isFinite(value.durationMs) ? value.durationMs : null,
    errorMessage: typeof value.errorMessage === "string" ? value.errorMessage : null,
    artifactId: typeof value.artifactId === "string" ? value.artifactId : null
  };
}

function makeDerivedPipelineStage(
  key: string,
  label: string,
  status: ReviewPipelineStageStatus,
  artifactId: string | null,
  errorMessage: string | null
): ReviewPipelineStage {
  return {
    key,
    label,
    status,
    durationMs: null,
    errorMessage,
    artifactId
  };
}

function stageStatusFromArtifact(artifactId: string | null, runFailed: boolean): ReviewPipelineStageStatus {
  if (artifactId !== null) {
    return "succeeded";
  }

  return runFailed ? "failed" : "pending";
}

function normalizePipelineStageStatus(value: unknown): ReviewPipelineStageStatus {
  return value === "pending" || value === "running" || value === "succeeded" || value === "failed" || value === "skipped"
    ? value
    : "pending";
}

function deriveLogExcerpts(artifacts: ReviewRunArtifact[]): ReviewRunLogExcerpt[] {
  const logs: ReviewRunLogExcerpt[] = [];

  for (const artifact of artifacts) {
    if (artifact.artifactType !== "ci_log") {
      continue;
    }

    const artifactLogs = artifact.metadata.logs;

    if (Array.isArray(artifactLogs)) {
      artifactLogs.forEach((entry, index) => {
        const log = toLogExcerpt(entry, artifact, index);

        if (log !== null) {
          logs.push(log);
        }
      });
      continue;
    }

    if (typeof artifact.metadata.excerpt === "string") {
      logs.push({
        id: `${artifact.id}:excerpt`,
        source: "ci_log",
        title: typeof artifact.metadata.title === "string" ? artifact.metadata.title : "CI log excerpt",
        excerpt: artifact.metadata.excerpt,
        artifactId: artifact.id,
        storageKey: artifact.storageKey,
        redacted: artifact.metadata.redacted === true,
        truncated: artifact.metadata.truncated === true,
        createdAt: artifact.createdAt
      });
    }
  }

  return logs;
}

function toLogExcerpt(value: unknown, artifact: ReviewRunArtifact, index: number): ReviewRunLogExcerpt | null {
  if (!isRecord(value)) {
    return null;
  }

  const excerpt = typeof value.excerpt === "string" ? value.excerpt : typeof value.content === "string" ? value.content : null;

  if (excerpt === null) {
    return null;
  }

  return {
    id: `${artifact.id}:log:${index}`,
    source: "ci_log",
    title: typeof value.name === "string" ? value.name : `CI log ${index + 1}`,
    excerpt,
    artifactId: artifact.id,
    storageKey: artifact.storageKey,
    redacted: value.redacted === true,
    truncated: value.truncated === true,
    createdAt: artifact.createdAt
  };
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

function deriveRiskLevel(metrics: Record<string, unknown>, changedFiles: ReviewRunChangedFile[]): ReviewRunRiskLevel {
  if (metrics.riskLevel === "low" || metrics.riskLevel === "medium" || metrics.riskLevel === "high") {
    return metrics.riskLevel;
  }

  if (changedFiles.some((file) => file.riskFlags.some((flag) => ["auth", "secrets", "infra", "migration"].includes(flag)))) {
    return "high";
  }

  if (changedFiles.some((file) => file.riskFlags.length > 0 || file.isInfrastructure)) {
    return "medium";
  }

  return changedFiles.length > 0 ? "low" : "unknown";
}

function readNullableNumberMetric(metrics: Record<string, unknown>, key: string): number | null {
  const value = metrics[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

function toNullableNumber(value: string | number | null): number | null {
  return value === null ? null : Number(value);
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
