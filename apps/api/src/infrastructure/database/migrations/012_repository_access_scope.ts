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

-- Backfill only repositories where the member has existing GitHub-authored PR
-- activity. SaaS developer accounts must not inherit workspace-wide visibility.
INSERT INTO repository_access (repository_id, clerk_user_id, granted_by_clerk_user_id)
SELECT DISTINCT r.id, wm.clerk_user_id, NULL
FROM pull_requests pr
JOIN repositories r ON r.id = pr.repository_id
JOIN github_installations gi ON gi.id = r.installation_id
JOIN workspace_memberships wm ON wm.workspace_id = gi.workspace_id
JOIN github_oauth_connections goc ON goc.clerk_user_id = wm.clerk_user_id
WHERE wm.active = true
  AND lower(wm.role) <> 'admin'
  AND lower(goc.github_login) = lower(pr.author_login)
ON CONFLICT (repository_id, clerk_user_id) DO NOTHING;
`
};
