import type { DatabaseMigration } from "../migrations";

export const dashboardAuthRetryStateMigration: DatabaseMigration = {
  id: "003_dashboard_auth_retry_state",
  name: "dashboard authorization and review retry state",
  sql: `
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY,
  clerk_org_id text UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  clerk_user_id text NOT NULL,
  role text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, clerk_user_id),
  CONSTRAINT workspace_memberships_role_check CHECK (role IN ('owner', 'admin', 'developer', 'viewer'))
);

ALTER TABLE github_installations
  ADD COLUMN workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS review_run_retries (
  id uuid PRIMARY KEY,
  original_review_run_id uuid NOT NULL REFERENCES review_runs(id) ON DELETE CASCADE,
  retry_review_run_id uuid NOT NULL REFERENCES review_runs(id) ON DELETE CASCADE,
  retry_delivery_id text NOT NULL REFERENCES github_deliveries(delivery_id),
  retry_job_id text,
  created_by_clerk_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_run_retries_original_unique UNIQUE (original_review_run_id),
  CONSTRAINT review_run_retries_retry_run_unique UNIQUE (retry_review_run_id),
  CONSTRAINT review_run_retries_retry_delivery_unique UNIQUE (retry_delivery_id)
);

CREATE INDEX IF NOT EXISTS github_installations_workspace_idx
  ON github_installations (workspace_id, installation_id);

CREATE INDEX IF NOT EXISTS workspace_memberships_user_workspace_idx
  ON workspace_memberships (clerk_user_id, workspace_id, active);

CREATE INDEX IF NOT EXISTS review_run_retries_created_idx
  ON review_run_retries (created_at DESC);
`
};
