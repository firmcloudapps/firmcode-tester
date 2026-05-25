import type { DatabaseMigration } from "../migrations";

export const workspaceMembershipAuditMigration: DatabaseMigration = {
  id: "010_workspace_membership_audit",
  name: "workspace membership role audit events",
  sql: `
CREATE TABLE IF NOT EXISTS workspace_audit_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_clerk_user_id text NOT NULL,
  target_clerk_user_id text NOT NULL,
  event_type text NOT NULL,
  previous_role text,
  next_role text,
  source text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_audit_events_event_type_check CHECK (event_type IN ('membership_role_changed')),
  CONSTRAINT workspace_audit_events_previous_role_check CHECK (previous_role IS NULL OR previous_role IN ('owner', 'admin', 'developer', 'viewer')),
  CONSTRAINT workspace_audit_events_next_role_check CHECK (next_role IS NULL OR next_role IN ('owner', 'admin', 'developer', 'viewer'))
);

CREATE INDEX IF NOT EXISTS workspace_audit_events_workspace_created_idx
  ON workspace_audit_events (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS workspace_audit_events_target_created_idx
  ON workspace_audit_events (target_clerk_user_id, created_at DESC);
`
};
