import type { DatabaseMigration } from "../migrations";

export const repositoryReviewConfigurationMigration: DatabaseMigration = {
  id: "004_repository_review_configuration",
  name: "repository review configuration",
  sql: `
CREATE TABLE IF NOT EXISTS repository_review_configurations (
  repository_id uuid PRIMARY KEY REFERENCES repositories(id) ON DELETE CASCADE,
  automation_enabled boolean NOT NULL DEFAULT true,
  draft_pr_reviews_enabled boolean NOT NULL DEFAULT false,
  max_inline_comments integer NOT NULL DEFAULT 10,
  severity_threshold text NOT NULL DEFAULT 'medium',
  semgrep_enabled boolean NOT NULL DEFAULT true,
  tree_sitter_enabled boolean NOT NULL DEFAULT true,
  ci_explanation_enabled boolean NOT NULL DEFAULT true,
  infrastructure_review_enabled boolean NOT NULL DEFAULT true,
  dry_run_enabled boolean NOT NULL DEFAULT true,
  updated_by_clerk_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT repository_review_configurations_max_inline_comments_check CHECK (
    max_inline_comments >= 0 AND max_inline_comments <= 50
  ),
  CONSTRAINT repository_review_configurations_severity_threshold_check CHECK (
    severity_threshold IN ('info', 'low', 'medium', 'high', 'critical')
  )
);

INSERT INTO repository_review_configurations (
  repository_id,
  automation_enabled,
  created_at,
  updated_at
)
SELECT
  id,
  enabled,
  created_at,
  updated_at
FROM repositories
ON CONFLICT (repository_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS repository_review_configurations_automation_idx
  ON repository_review_configurations (automation_enabled, updated_at DESC);
`
};
