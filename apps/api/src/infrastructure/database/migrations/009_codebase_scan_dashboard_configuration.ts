import type { DatabaseMigration } from "../migrations";

export const codebaseScanDashboardConfigurationMigration: DatabaseMigration = {
  id: "009_codebase_scan_dashboard_configuration",
  name: "codebase scan dashboard configuration",
  sql: `
ALTER TABLE repository_review_configurations
  ADD COLUMN IF NOT EXISTS codebase_scan_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS codebase_scan_cadence_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS codebase_scan_ignored_paths_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS codebase_scan_severity_threshold text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS codebase_scan_max_files integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS codebase_scan_max_bytes integer NOT NULL DEFAULT 10000000;

ALTER TABLE repository_review_configurations
  ADD CONSTRAINT repository_review_configurations_codebase_scan_cadence_check CHECK (
    codebase_scan_cadence_hours >= 1 AND codebase_scan_cadence_hours <= 720
  ),
  ADD CONSTRAINT repository_review_configurations_codebase_scan_threshold_check CHECK (
    codebase_scan_severity_threshold IN ('info', 'low', 'medium', 'high', 'critical')
  ),
  ADD CONSTRAINT repository_review_configurations_codebase_scan_max_files_check CHECK (
    codebase_scan_max_files >= 1 AND codebase_scan_max_files <= 5000
  ),
  ADD CONSTRAINT repository_review_configurations_codebase_scan_max_bytes_check CHECK (
    codebase_scan_max_bytes >= 1 AND codebase_scan_max_bytes <= 100000000
  );

CREATE TABLE IF NOT EXISTS codebase_scan_finding_status_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  finding_id uuid NOT NULL REFERENCES codebase_scan_findings(id) ON DELETE CASCADE,
  previous_status text NOT NULL,
  next_status text NOT NULL,
  actor_clerk_user_id text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT codebase_scan_finding_status_events_previous_status_check CHECK (
    previous_status IN ('open', 'resolved', 'suppressed', 'false_positive')
  ),
  CONSTRAINT codebase_scan_finding_status_events_next_status_check CHECK (
    next_status IN ('open', 'resolved', 'suppressed', 'false_positive')
  )
);

CREATE INDEX IF NOT EXISTS repository_review_configurations_scan_schedule_idx
  ON repository_review_configurations (codebase_scan_enabled, codebase_scan_cadence_hours, updated_at DESC);

CREATE INDEX IF NOT EXISTS codebase_scan_finding_status_events_finding_idx
  ON codebase_scan_finding_status_events (finding_id, created_at DESC);

CREATE INDEX IF NOT EXISTS codebase_scan_finding_status_events_workspace_idx
  ON codebase_scan_finding_status_events (workspace_id, created_at DESC);
`
};
