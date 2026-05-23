import { describe, expect, it } from "vitest";
import {
  PostgresPublishedCommentStore,
  type PublishedSummaryCommentRecord
} from "../../../src/infrastructure/github/published-comment-store";
import type { DatabaseExecutor, DatabaseQueryResult } from "../../../src/infrastructure/database/migrations";

class RecordingDatabase implements DatabaseExecutor {
  readonly queries: Array<{ sql: string; values?: readonly unknown[] }> = [];

  async query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<DatabaseQueryResult<Row>> {
    this.queries.push({ sql, values });
    return { rows: [] };
  }
}

describe("PostgresPublishedCommentStore", () => {
  it("records live summary comments idempotently by GitHub comment id", async () => {
    const database = new RecordingDatabase();
    const store = new PostgresPublishedCommentStore(database, () => "comment-record-1");

    await store.recordPublishedSummaryComment(summaryRecord({ githubCommentId: 123 }));

    expect(database.queries).toHaveLength(1);
    expect(database.queries[0].sql).toContain("ON CONFLICT (github_comment_id)");
    expect(database.queries[0].sql).toContain("review_run_id = EXCLUDED.review_run_id");
    expect(database.queries[0].values).toEqual(["comment-record-1", "run-1", 123, "summary", "hash", false]);
  });

  it("keeps dry-run summaries idempotent by run and body hash", async () => {
    const database = new RecordingDatabase();
    const store = new PostgresPublishedCommentStore(database, () => "comment-record-1");

    await store.recordPublishedSummaryComment(summaryRecord({ githubCommentId: null, dryRun: true }));

    expect(database.queries).toHaveLength(1);
    expect(database.queries[0].sql).toContain("ON CONFLICT (review_run_id, comment_type, body_hash)");
    expect(database.queries[0].values).toEqual(["comment-record-1", "run-1", null, "summary", "hash", true]);
  });
});

function summaryRecord(input: { githubCommentId: number | null; dryRun?: boolean }): PublishedSummaryCommentRecord {
  return {
    reviewRunId: "run-1",
    githubCommentId: input.githubCommentId,
    body: "summary",
    bodyHash: "hash",
    dryRun: input.dryRun ?? false
  };
}
