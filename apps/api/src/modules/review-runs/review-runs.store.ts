import type { ReviewRunDetail, ReviewRunPublishedComment, ReviewRunStatus } from "@firmcode/shared";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const REVIEW_RUNS_STORE = Symbol("REVIEW_RUNS_STORE");

export interface ReviewRunsStore {
  getReviewRunDetail(reviewRunId: string): Promise<ReviewRunDetail | null>;
}

interface ReviewRunDetailRow {
  readonly id: string;
  readonly repository_id: string;
  readonly pull_request_id: string;
  readonly repository_full_name: string;
  readonly pull_request_number: number;
  readonly trigger_event: string;
  readonly head_sha: string;
  readonly status: ReviewRunStatus;
  readonly started_at: Date | null;
  readonly finished_at: Date | null;
  readonly error_code: string | null;
  readonly error_message: string | null;
  readonly metrics_json: Record<string, unknown>;
  readonly findings_count: string | number;
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
  async getReviewRunDetail(_reviewRunId: string): Promise<ReviewRunDetail | null> {
    return null;
  }
}

export class PostgresReviewRunsStore implements ReviewRunsStore {
  constructor(private readonly database: DatabaseExecutor) {}

  async getReviewRunDetail(reviewRunId: string): Promise<ReviewRunDetail | null> {
    const runResult = await this.database.query<ReviewRunDetailRow>(
      `
SELECT
  rr.id,
  rr.repository_id,
  rr.pull_request_id,
  r.full_name AS repository_full_name,
  pr.number AS pull_request_number,
  rr.trigger_event,
  rr.head_sha,
  rr.status,
  rr.started_at,
  rr.finished_at,
  rr.error_code,
  rr.error_message,
  rr.metrics_json,
  rr.created_at,
  count(f.id)::text AS findings_count
FROM review_runs rr
JOIN repositories r ON r.id = rr.repository_id
JOIN pull_requests pr ON pr.id = rr.pull_request_id
LEFT JOIN findings f ON f.review_run_id = rr.id
WHERE rr.id = $1
GROUP BY
  rr.id,
  rr.repository_id,
  rr.pull_request_id,
  r.full_name,
  pr.number,
  rr.trigger_event,
  rr.head_sha,
  rr.status,
  rr.started_at,
  rr.finished_at,
  rr.error_code,
  rr.error_message,
  rr.metrics_json,
  rr.created_at
`,
      [reviewRunId]
    );
    const row = runResult.rows[0];

    if (row === undefined) {
      return null;
    }

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

    return {
      id: row.id,
      repositoryId: row.repository_id,
      pullRequestId: row.pull_request_id,
      repositoryFullName: row.repository_full_name,
      pullRequestNumber: row.pull_request_number,
      triggerEvent: row.trigger_event,
      headSha: row.head_sha,
      status: row.status,
      findingsCount: Number(row.findings_count),
      startedAt: toIsoString(row.started_at),
      finishedAt: toIsoString(row.finished_at),
      errorCode: row.error_code,
      errorMessage: row.error_message,
      metrics: row.metrics_json,
      createdAt: toRequiredIsoString(row.created_at),
      publishedComments: commentsResult.rows.map(toPublishedComment)
    };
  }
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
