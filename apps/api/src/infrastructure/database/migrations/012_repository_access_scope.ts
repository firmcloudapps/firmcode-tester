import type { DatabaseMigration } from "../migrations";

export const repositoryAccessScopeMigration: DatabaseMigration = {
  id: "012_repository_access_scope",
  name: "per-developer repository access scoping",
  sql: `
CREATE TABLE IF NOT EXISTS repository_access (
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  clerk_user_id text NOT NULL,
  granted_by_clerk_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (repository_id, clerk_user_id)
);

CREATE INDEX IF NOT EXISTS repository_access_user_idx
  ON repository_access (clerk_user_id, repository_id);

-- Backfill: preserve existing visibility for current non-admin members so the
-- new scoping does not retroactively hide repositories they already worked with.
INSERT INTO repository_access (repository_id, clerk_user_id, granted_by_clerk_user_id)
SELECT r.id, wm.clerk_user_id, NULL
FROM repositories r
JOIN github_installations gi ON gi.id = r.installation_id
JOIN workspace_memberships wm ON wm.workspace_id = gi.workspace_id
WHERE wm.active = true
  AND wm.role IN ('developer', 'viewer')
ON CONFLICT (repository_id, clerk_user_id) DO NOTHING;
`
};
