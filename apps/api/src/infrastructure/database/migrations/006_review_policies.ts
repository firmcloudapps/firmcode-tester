import type { DatabaseMigration } from "../migrations";

export const reviewPoliciesMigration: DatabaseMigration = {
  id: "006_review_policies",
  name: "workspace and repository review policies",
  sql: `
CREATE TABLE IF NOT EXISTS review_policies (
  id text PRIMARY KEY,
  scope text NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id uuid REFERENCES repositories(id) ON DELETE CASCADE,
  review_preferences_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_inline_comments integer NOT NULL DEFAULT 10,
  severity_threshold text NOT NULL DEFAULT 'medium',
  category_enablement_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_instructions text NOT NULL DEFAULT '',
  ignored_paths_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_file_patterns_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  semgrep_policy_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  analysis_toggles_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  infrastructure_security_policy_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by_clerk_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_policies_scope_check CHECK (scope IN ('workspace', 'repository')),
  CONSTRAINT review_policies_scope_repository_check CHECK (
    (scope = 'workspace' AND repository_id IS NULL)
    OR (scope = 'repository' AND repository_id IS NOT NULL)
  ),
  CONSTRAINT review_policies_max_inline_comments_check CHECK (
    max_inline_comments >= 0 AND max_inline_comments <= 50
  ),
  CONSTRAINT review_policies_severity_threshold_check CHECK (
    severity_threshold IN ('info', 'low', 'medium', 'high', 'critical')
  ),
  CONSTRAINT review_policies_repository_unique UNIQUE (repository_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS review_policies_workspace_unique
  ON review_policies (workspace_id)
  WHERE scope = 'workspace';

CREATE INDEX IF NOT EXISTS review_policies_workspace_scope_idx
  ON review_policies (workspace_id, scope, updated_at DESC);
`
};
