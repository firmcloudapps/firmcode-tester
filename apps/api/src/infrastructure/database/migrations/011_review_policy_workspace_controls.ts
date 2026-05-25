import type { DatabaseMigration } from "../migrations";

export const reviewPolicyWorkspaceControlsMigration: DatabaseMigration = {
  id: "011_review_policy_workspace_controls",
  name: "review policy workspace controls",
  sql: `
ALTER TABLE review_policies
  ADD COLUMN IF NOT EXISTS workspace_controls_json jsonb NOT NULL DEFAULT '{}'::jsonb;
`
};
