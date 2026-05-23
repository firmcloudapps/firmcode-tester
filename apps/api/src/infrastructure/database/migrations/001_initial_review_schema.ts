import type { DatabaseMigration } from "../migrations";

export const initialReviewSchemaMigration: DatabaseMigration = {
  id: "001_initial_review_schema",
  name: "initial review persistence schema",
  sql: `
CREATE TABLE IF NOT EXISTS github_installations (
  id uuid PRIMARY KEY,
  installation_id bigint NOT NULL,
  account_login text,
  account_type text,
  permissions_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT github_installations_installation_id_unique UNIQUE (installation_id)
);

CREATE TABLE IF NOT EXISTS repositories (
  id uuid PRIMARY KEY,
  installation_id uuid NOT NULL REFERENCES github_installations(id) ON DELETE CASCADE,
  github_repository_id bigint NOT NULL,
  owner text NOT NULL,
  name text NOT NULL,
  full_name text NOT NULL,
  private boolean NOT NULL DEFAULT false,
  default_branch text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT repositories_github_repository_id_unique UNIQUE (github_repository_id),
  CONSTRAINT repositories_installation_full_name_unique UNIQUE (installation_id, full_name)
);

CREATE TABLE IF NOT EXISTS pull_requests (
  id uuid PRIMARY KEY,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  github_pr_id bigint NOT NULL,
  number integer NOT NULL,
  title text NOT NULL,
  author_login text NOT NULL,
  base_ref text NOT NULL,
  head_ref text NOT NULL,
  base_sha text NOT NULL,
  head_sha text NOT NULL,
  state text NOT NULL,
  draft boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pull_requests_github_pr_id_unique UNIQUE (github_pr_id),
  CONSTRAINT pull_requests_repository_number_unique UNIQUE (repository_id, number)
);

CREATE TABLE IF NOT EXISTS github_deliveries (
  delivery_id text PRIMARY KEY,
  event_name text NOT NULL,
  action text,
  installation_id bigint,
  repository_id bigint,
  pull_request_number integer,
  head_sha text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'processing',
  error text,
  CONSTRAINT github_deliveries_status_check CHECK (status IN ('processing', 'processed', 'ignored', 'failed'))
);

CREATE TABLE IF NOT EXISTS review_runs (
  id uuid PRIMARY KEY,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  pull_request_id uuid NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
  delivery_id text NOT NULL REFERENCES github_deliveries(delivery_id),
  trigger_event text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  head_sha text NOT NULL,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  error_message text,
  metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_runs_delivery_id_unique UNIQUE (delivery_id),
  CONSTRAINT review_runs_status_check CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'superseded'))
);

CREATE TABLE IF NOT EXISTS changed_files (
  id uuid PRIMARY KEY,
  review_run_id uuid NOT NULL REFERENCES review_runs(id) ON DELETE CASCADE,
  path text NOT NULL,
  status text NOT NULL,
  additions integer NOT NULL DEFAULT 0,
  deletions integer NOT NULL DEFAULT 0,
  patch text,
  language text,
  is_infrastructure boolean NOT NULL DEFAULT false,
  is_supported boolean NOT NULL DEFAULT true,
  risk_flags_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT changed_files_review_run_path_unique UNIQUE (review_run_id, path),
  CONSTRAINT changed_files_additions_nonnegative CHECK (additions >= 0),
  CONSTRAINT changed_files_deletions_nonnegative CHECK (deletions >= 0)
);

CREATE TABLE IF NOT EXISTS analysis_artifacts (
  id uuid PRIMARY KEY,
  review_run_id uuid NOT NULL REFERENCES review_runs(id) ON DELETE CASCADE,
  artifact_type text NOT NULL,
  storage_key text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analysis_artifacts_type_check CHECK (artifact_type IN ('diff', 'treesitter', 'semgrep', 'context_pack', 'llm_raw', 'ci_log')),
  CONSTRAINT analysis_artifacts_run_type_storage_unique UNIQUE (review_run_id, artifact_type, storage_key)
);

CREATE TABLE IF NOT EXISTS findings (
  id uuid PRIMARY KEY,
  review_run_id uuid NOT NULL REFERENCES review_runs(id) ON DELETE CASCADE,
  source text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL,
  confidence text NOT NULL,
  file_path text,
  start_line integer,
  end_line integer,
  title text NOT NULL,
  body text NOT NULL,
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggestion text,
  dedupe_key text NOT NULL,
  post_as_inline boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT findings_source_check CHECK (source IN ('semgrep', 'llm', 'ci', 'policy')),
  CONSTRAINT findings_category_check CHECK (category IN ('bug', 'security', 'performance', 'maintainability', 'test', 'infra', 'ci')),
  CONSTRAINT findings_severity_check CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  CONSTRAINT findings_confidence_check CHECK (confidence IN ('low', 'medium', 'high')),
  CONSTRAINT findings_line_bounds_check CHECK (
    (start_line IS NULL AND end_line IS NULL)
    OR (start_line IS NOT NULL AND end_line IS NOT NULL AND start_line > 0 AND end_line >= start_line)
  ),
  CONSTRAINT findings_review_run_dedupe_unique UNIQUE (review_run_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS published_comments (
  id uuid PRIMARY KEY,
  review_run_id uuid NOT NULL REFERENCES review_runs(id) ON DELETE CASCADE,
  finding_id uuid REFERENCES findings(id) ON DELETE SET NULL,
  github_comment_id bigint,
  github_review_id bigint,
  comment_type text NOT NULL,
  file_path text,
  line integer,
  body text,
  body_hash text NOT NULL,
  dry_run boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT published_comments_type_check CHECK (comment_type IN ('summary', 'inline', 'review')),
  CONSTRAINT published_comments_line_check CHECK (line IS NULL OR line > 0),
  CONSTRAINT published_comments_review_type_hash_unique UNIQUE (review_run_id, comment_type, body_hash)
);

CREATE UNIQUE INDEX IF NOT EXISTS published_comments_github_comment_id_unique
  ON published_comments (github_comment_id)
  WHERE github_comment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS published_comments_finding_type_unique
  ON published_comments (finding_id, comment_type)
  WHERE finding_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS github_deliveries_received_status_idx
  ON github_deliveries (received_at DESC, status);

CREATE INDEX IF NOT EXISTS github_deliveries_repository_pr_idx
  ON github_deliveries (repository_id, pull_request_number, received_at DESC);

CREATE INDEX IF NOT EXISTS repositories_installation_enabled_idx
  ON repositories (installation_id, enabled, full_name);

CREATE INDEX IF NOT EXISTS repositories_owner_name_idx
  ON repositories (owner, name);

CREATE INDEX IF NOT EXISTS pull_requests_repository_updated_idx
  ON pull_requests (repository_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS pull_requests_repository_head_idx
  ON pull_requests (repository_id, head_sha);

CREATE INDEX IF NOT EXISTS review_runs_repository_created_idx
  ON review_runs (repository_id, created_at DESC);

CREATE INDEX IF NOT EXISTS review_runs_pull_request_created_idx
  ON review_runs (pull_request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS review_runs_status_created_idx
  ON review_runs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS review_runs_head_sha_idx
  ON review_runs (head_sha);

CREATE INDEX IF NOT EXISTS changed_files_review_run_path_idx
  ON changed_files (review_run_id, path);

CREATE INDEX IF NOT EXISTS changed_files_review_run_supported_idx
  ON changed_files (review_run_id, is_supported, is_infrastructure);

CREATE INDEX IF NOT EXISTS analysis_artifacts_run_type_idx
  ON analysis_artifacts (review_run_id, artifact_type, created_at DESC);

CREATE INDEX IF NOT EXISTS findings_review_run_severity_idx
  ON findings (review_run_id, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS findings_review_run_source_idx
  ON findings (review_run_id, source, created_at DESC);

CREATE INDEX IF NOT EXISTS findings_file_path_idx
  ON findings (file_path);

CREATE INDEX IF NOT EXISTS published_comments_review_run_idx
  ON published_comments (review_run_id, created_at DESC);
`
};
