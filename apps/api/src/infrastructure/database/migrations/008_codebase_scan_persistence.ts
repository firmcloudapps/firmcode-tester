import type { DatabaseMigration } from "../migrations";

export const codebaseScanPersistenceMigration: DatabaseMigration = {
  id: "008_codebase_scan_persistence",
  name: "codebase scan persistence",
  sql: `
CREATE TABLE IF NOT EXISTS codebase_scan_runs (
  id uuid PRIMARY KEY,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  installation_id uuid NOT NULL REFERENCES github_installations(id) ON DELETE CASCADE,
  trigger text NOT NULL,
  default_branch text NOT NULL,
  commit_sha text,
  status text NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  error_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  artifacts_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT codebase_scan_runs_trigger_check CHECK (trigger IN ('install', 'scheduled', 'manual', 'push')),
  CONSTRAINT codebase_scan_runs_status_check CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'superseded')),
  CONSTRAINT codebase_scan_runs_commit_sha_check CHECK (commit_sha IS NULL OR commit_sha <> ''),
  CONSTRAINT codebase_scan_runs_default_branch_check CHECK (default_branch <> '')
);

CREATE TABLE IF NOT EXISTS codebase_scan_findings (
  id uuid PRIMARY KEY,
  scan_run_id uuid NOT NULL REFERENCES codebase_scan_runs(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
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
  recommendation text,
  dedupe_key text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT codebase_scan_findings_source_check CHECK (source IN ('semgrep', 'llm', 'tree_sitter', 'ci', 'policy')),
  CONSTRAINT codebase_scan_findings_category_check CHECK (category IN ('bug', 'security', 'performance', 'maintainability', 'test', 'infra', 'ci')),
  CONSTRAINT codebase_scan_findings_severity_check CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  CONSTRAINT codebase_scan_findings_confidence_check CHECK (confidence IN ('low', 'medium', 'high')),
  CONSTRAINT codebase_scan_findings_status_check CHECK (status IN ('open', 'resolved', 'suppressed', 'false_positive')),
  CONSTRAINT codebase_scan_findings_line_bounds_check CHECK (
    (start_line IS NULL AND end_line IS NULL)
    OR (start_line IS NOT NULL AND end_line IS NOT NULL AND start_line > 0 AND end_line >= start_line)
  ),
  CONSTRAINT codebase_scan_findings_repository_dedupe_unique UNIQUE (repository_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS codebase_scan_runs_repository_created_idx
  ON codebase_scan_runs (repository_id, created_at DESC);

CREATE INDEX IF NOT EXISTS codebase_scan_runs_repository_status_idx
  ON codebase_scan_runs (repository_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS codebase_scan_runs_repository_successful_commit_unique
  ON codebase_scan_runs (repository_id, commit_sha)
  WHERE status = 'succeeded' AND commit_sha IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS codebase_scan_runs_active_commit_unique
  ON codebase_scan_runs (repository_id, commit_sha)
  WHERE status IN ('queued', 'running') AND commit_sha IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS codebase_scan_runs_active_trigger_unknown_commit_unique
  ON codebase_scan_runs (repository_id, trigger)
  WHERE status IN ('queued', 'running') AND commit_sha IS NULL;

CREATE INDEX IF NOT EXISTS codebase_scan_findings_scan_run_idx
  ON codebase_scan_findings (scan_run_id, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS codebase_scan_findings_repository_status_severity_idx
  ON codebase_scan_findings (repository_id, status, severity, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS codebase_scan_findings_repository_file_path_idx
  ON codebase_scan_findings (repository_id, file_path);

CREATE INDEX IF NOT EXISTS codebase_scan_findings_dedupe_idx
  ON codebase_scan_findings (dedupe_key);
`
};
