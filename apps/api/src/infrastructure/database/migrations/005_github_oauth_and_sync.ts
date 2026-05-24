import type { DatabaseMigration } from "../migrations";

export const githubOAuthAndSyncMigration: DatabaseMigration = {
  id: "005_github_oauth_and_sync",
  name: "github oauth connection and workspace sync state",
  sql: `
CREATE TABLE IF NOT EXISTS github_oauth_connections (
  clerk_user_id text PRIMARY KEY,
  github_user_id bigint NOT NULL,
  github_login text NOT NULL,
  github_name text,
  github_avatar_url text,
  scopes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  token_hash text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT github_oauth_connections_github_user_id_unique UNIQUE (github_user_id)
);

CREATE TABLE IF NOT EXISTS github_oauth_states (
  state_hash text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  clerk_user_id text NOT NULL,
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS github_oauth_states_workspace_user_idx
  ON github_oauth_states (workspace_id, clerk_user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS github_oauth_connections_login_idx
  ON github_oauth_connections (github_login);
`
};
