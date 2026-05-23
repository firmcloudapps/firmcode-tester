import type { DatabaseMigration } from "../migrations";

export const dryRunPublishedCommentsMigration: DatabaseMigration = {
  id: "002_dry_run_published_comments",
  name: "Add dry run published comment output fields",
  sql: `
ALTER TABLE published_comments
  ADD COLUMN IF NOT EXISTS github_review_id bigint,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS dry_run boolean NOT NULL DEFAULT false;
`
};
