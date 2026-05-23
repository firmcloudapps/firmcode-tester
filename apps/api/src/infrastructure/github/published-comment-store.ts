import { createHash, randomUUID } from "crypto";
import type { DatabaseExecutor } from "../database/migrations";

export interface PublishedSummaryCommentRecord {
  readonly reviewRunId: string;
  readonly githubCommentId: number | null;
  readonly body: string;
  readonly bodyHash: string;
  readonly dryRun: boolean;
}

export interface PublishedInlineCommentRecord {
  readonly reviewRunId: string;
  readonly findingId: string;
  readonly githubReviewId: number | null;
  readonly githubCommentId: number | null;
  readonly filePath: string;
  readonly line: number;
  readonly body: string;
  readonly bodyHash: string;
  readonly dryRun: boolean;
}

export interface PublishedCommentStore {
  recordPublishedSummaryComment(record: PublishedSummaryCommentRecord): Promise<void>;
  recordPublishedInlineComments(records: readonly PublishedInlineCommentRecord[]): Promise<void>;
}

export class NoopPublishedCommentStore implements PublishedCommentStore {
  async recordPublishedSummaryComment(_record: PublishedSummaryCommentRecord): Promise<void> {
    return undefined;
  }

  async recordPublishedInlineComments(_records: readonly PublishedInlineCommentRecord[]): Promise<void> {
    return undefined;
  }
}

export class InMemoryPublishedCommentStore implements PublishedCommentStore {
  readonly summaryComments: PublishedSummaryCommentRecord[] = [];
  readonly inlineComments: PublishedInlineCommentRecord[] = [];

  async recordPublishedSummaryComment(record: PublishedSummaryCommentRecord): Promise<void> {
    this.summaryComments.push(record);
  }

  async recordPublishedInlineComments(records: readonly PublishedInlineCommentRecord[]): Promise<void> {
    this.inlineComments.push(...records);
  }
}

export class PostgresPublishedCommentStore implements PublishedCommentStore {
  constructor(
    private readonly database: DatabaseExecutor,
    private readonly createId: () => string = randomUUID
  ) {}

  async recordPublishedSummaryComment(record: PublishedSummaryCommentRecord): Promise<void> {
    if (record.githubCommentId !== null) {
      await this.database.query(
        `
INSERT INTO published_comments (
  id,
  review_run_id,
  github_comment_id,
  comment_type,
  body,
  body_hash,
  dry_run
) VALUES ($1, $2, $3, 'summary', $4, $5, $6)
ON CONFLICT (github_comment_id) WHERE github_comment_id IS NOT NULL DO UPDATE
SET review_run_id = EXCLUDED.review_run_id,
    comment_type = EXCLUDED.comment_type,
    body = EXCLUDED.body,
    body_hash = EXCLUDED.body_hash,
    dry_run = EXCLUDED.dry_run
`,
        [this.createId(), record.reviewRunId, record.githubCommentId, record.body, record.bodyHash, record.dryRun]
      );
      return;
    }

    await this.database.query(
      `
INSERT INTO published_comments (
  id,
  review_run_id,
  github_comment_id,
  comment_type,
  body,
  body_hash,
  dry_run
) VALUES ($1, $2, $3, 'summary', $4, $5, $6)
ON CONFLICT (review_run_id, comment_type, body_hash) DO UPDATE
SET github_comment_id = EXCLUDED.github_comment_id,
    body = EXCLUDED.body,
    dry_run = EXCLUDED.dry_run
`,
      [this.createId(), record.reviewRunId, record.githubCommentId, record.body, record.bodyHash, record.dryRun]
    );
  }

  async recordPublishedInlineComments(records: readonly PublishedInlineCommentRecord[]): Promise<void> {
    for (const record of records) {
      await this.database.query(
        `
INSERT INTO published_comments (
  id,
  review_run_id,
  finding_id,
  github_review_id,
  github_comment_id,
  comment_type,
  file_path,
  line,
  body,
  body_hash,
  dry_run
) VALUES ($1, $2, $3, $4, $5, 'inline', $6, $7, $8, $9, $10)
ON CONFLICT (review_run_id, comment_type, body_hash) DO UPDATE
SET github_review_id = EXCLUDED.github_review_id,
    github_comment_id = EXCLUDED.github_comment_id,
    finding_id = COALESCE(EXCLUDED.finding_id, published_comments.finding_id),
    file_path = EXCLUDED.file_path,
    line = EXCLUDED.line,
    body = EXCLUDED.body,
    dry_run = EXCLUDED.dry_run
`,
        [
          this.createId(),
          record.reviewRunId,
          isUuid(record.findingId) ? record.findingId : null,
          record.githubReviewId,
          record.githubCommentId,
          record.filePath,
          record.line,
          record.body,
          record.bodyHash,
          record.dryRun
        ]
      );
    }
  }
}

export function hashPublishedCommentBody(input: {
  readonly reviewRunId?: string;
  readonly findingId?: string;
  readonly path?: string;
  readonly line?: number;
  readonly body: string;
}): string {
  const hash = createHash("sha256");

  for (const value of [input.reviewRunId, input.findingId, input.path, input.line?.toString(), input.body]) {
    hash.update(value ?? "");
    hash.update("\0");
  }

  return hash.digest("hex");
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/iu.test(value);
}
