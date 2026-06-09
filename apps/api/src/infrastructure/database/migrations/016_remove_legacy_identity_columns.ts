import type { DatabaseMigration } from "../migrations";

export const removeLegacyIdentityColumnsMigration: DatabaseMigration = {
  id: "016_remove_legacy_identity_columns",
  name: "remove legacy provider-specific identity columns",
  sql: `
UPDATE workspaces
SET identity_provider = 'insforge'
WHERE identity_provider IS NULL
   OR identity_provider <> 'insforge';

UPDATE workspaces
SET identity_provider_org_id = clerk_org_id
WHERE identity_provider_org_id IS NULL
  AND clerk_org_id IS NOT NULL;

UPDATE workspace_memberships
SET user_id = clerk_user_id
WHERE user_id IS NULL;

UPDATE review_run_retries
SET created_by_user_id = created_by_clerk_user_id
WHERE created_by_user_id IS NULL;

UPDATE workspace_audit_events
SET actor_user_id = actor_clerk_user_id
WHERE actor_user_id IS NULL;

UPDATE workspace_audit_events
SET target_user_id = target_clerk_user_id
WHERE target_user_id IS NULL;

UPDATE codebase_scan_finding_status_events
SET actor_user_id = actor_clerk_user_id
WHERE actor_user_id IS NULL;

UPDATE repository_review_configurations
SET updated_by_user_id = updated_by_clerk_user_id
WHERE updated_by_user_id IS NULL;

UPDATE review_policies
SET updated_by_user_id = updated_by_clerk_user_id
WHERE updated_by_user_id IS NULL;

UPDATE github_oauth_connections
SET user_id = clerk_user_id
WHERE user_id IS NULL;

UPDATE github_oauth_states
SET user_id = clerk_user_id
WHERE user_id IS NULL;

UPDATE repository_access
SET user_id = clerk_user_id
WHERE user_id IS NULL;

UPDATE repository_access
SET granted_by_user_id = granted_by_clerk_user_id
WHERE granted_by_user_id IS NULL;

ALTER TABLE workspace_memberships
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE review_run_retries
  ALTER COLUMN created_by_user_id SET NOT NULL;

ALTER TABLE workspace_audit_events
  ALTER COLUMN actor_user_id SET NOT NULL,
  ALTER COLUMN target_user_id SET NOT NULL;

ALTER TABLE codebase_scan_finding_status_events
  ALTER COLUMN actor_user_id SET NOT NULL;

ALTER TABLE github_oauth_connections
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE github_oauth_states
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE repository_access
  ALTER COLUMN user_id SET NOT NULL;

DROP INDEX IF EXISTS workspace_memberships_clerk_user_idx;
DROP INDEX IF EXISTS workspace_memberships_legacy_clerk_unique;
DROP INDEX IF EXISTS workspace_audit_events_target_clerk_user_idx;
DROP INDEX IF EXISTS github_oauth_states_workspace_user_idx;
DROP INDEX IF EXISTS repository_access_user_idx;

ALTER TABLE github_oauth_connections
  DROP CONSTRAINT IF EXISTS github_oauth_connections_pkey;

ALTER TABLE github_oauth_connections
  ADD CONSTRAINT github_oauth_connections_pkey PRIMARY KEY (user_id);

ALTER TABLE repository_access
  DROP CONSTRAINT IF EXISTS repository_access_pkey;

ALTER TABLE repository_access
  ADD CONSTRAINT repository_access_pkey PRIMARY KEY (repository_id, user_id);

CREATE INDEX IF NOT EXISTS github_oauth_states_workspace_user_idx
  ON github_oauth_states (workspace_id, user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS repository_access_user_idx
  ON repository_access (user_id, repository_id);

ALTER TABLE workspaces
  ALTER COLUMN identity_provider SET DEFAULT 'insforge';

ALTER TABLE workspaces
  DROP COLUMN IF EXISTS clerk_org_id;

ALTER TABLE workspace_memberships
  DROP COLUMN IF EXISTS clerk_user_id;

ALTER TABLE review_run_retries
  DROP COLUMN IF EXISTS created_by_clerk_user_id;

ALTER TABLE workspace_audit_events
  DROP COLUMN IF EXISTS actor_clerk_user_id,
  DROP COLUMN IF EXISTS target_clerk_user_id;

ALTER TABLE codebase_scan_finding_status_events
  DROP COLUMN IF EXISTS actor_clerk_user_id;

ALTER TABLE repository_review_configurations
  DROP COLUMN IF EXISTS updated_by_clerk_user_id;

ALTER TABLE review_policies
  DROP COLUMN IF EXISTS updated_by_clerk_user_id;

ALTER TABLE github_oauth_connections
  DROP COLUMN IF EXISTS clerk_user_id;

ALTER TABLE github_oauth_states
  DROP COLUMN IF EXISTS clerk_user_id;

ALTER TABLE repository_access
  DROP COLUMN IF EXISTS clerk_user_id,
  DROP COLUMN IF EXISTS granted_by_clerk_user_id;
`
};
