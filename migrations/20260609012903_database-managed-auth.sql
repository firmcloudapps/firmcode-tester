CREATE TABLE IF NOT EXISTS user_profiles (
  id text PRIMARY KEY,
  identity_provider text NOT NULL DEFAULT 'insforge',
  provider_user_id text NOT NULL,
  email text,
  email_verified boolean NOT NULL DEFAULT false,
  display_name text,
  avatar_url text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_provider_unique UNIQUE (identity_provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS workspace_roles (
  role text PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL,
  capabilities_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  system_role boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO workspace_roles (role, display_name, description, capabilities_json, system_role)
VALUES
  ('admin', 'Admin', 'Can manage workspace settings, billing, GitHub installations, and global review policy.', '["manage_billing","manage_github_installations","manage_sensitive_settings","manage_review_policies"]'::jsonb, true),
  ('developer', 'Developer', 'Can run reviews, manage repository configuration, and triage codebase findings.', '["retry_review_run","trigger_codebase_scan","manage_codebase_scan_findings","manage_repository_configuration","access_raw_artifacts"]'::jsonb, true)
ON CONFLICT (role) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    capabilities_json = EXCLUDED.capabilities_json,
    system_role = EXCLUDED.system_role,
    updated_at = now();

UPDATE workspace_memberships
SET role = CASE lower(role)
  WHEN 'owner' THEN 'admin'
  WHEN 'viewer' THEN 'developer'
  ELSE lower(role)
END
WHERE lower(role) IN ('owner', 'viewer', 'admin', 'developer');

UPDATE workspace_audit_events
SET previous_role = CASE lower(previous_role)
  WHEN 'owner' THEN 'admin'
  WHEN 'viewer' THEN 'developer'
  ELSE lower(previous_role)
END
WHERE previous_role IS NOT NULL
  AND lower(previous_role) IN ('owner', 'viewer', 'admin', 'developer');

UPDATE workspace_audit_events
SET next_role = CASE lower(next_role)
  WHEN 'owner' THEN 'admin'
  WHEN 'viewer' THEN 'developer'
  ELSE lower(next_role)
END
WHERE next_role IS NOT NULL
  AND lower(next_role) IN ('owner', 'viewer', 'admin', 'developer');

UPDATE workspace_memberships
SET user_id = clerk_user_id
WHERE user_id IS NULL;

INSERT INTO user_profiles (id, identity_provider, provider_user_id)
SELECT DISTINCT
  wm.user_id,
  COALESCE(w.identity_provider, 'insforge'),
  wm.user_id
FROM workspace_memberships wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

ALTER TABLE workspace_memberships
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE workspace_memberships
  DROP CONSTRAINT IF EXISTS workspace_memberships_pkey;

ALTER TABLE workspace_memberships
  ALTER COLUMN clerk_user_id DROP NOT NULL;

ALTER TABLE workspace_memberships
  ADD CONSTRAINT workspace_memberships_pkey PRIMARY KEY (workspace_id, user_id);

ALTER TABLE workspace_memberships
  ADD CONSTRAINT workspace_memberships_user_profile_fk FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE workspace_memberships
  ADD CONSTRAINT workspace_memberships_role_fk FOREIGN KEY (role) REFERENCES workspace_roles(role);

DELETE FROM workspace_roles
WHERE role NOT IN ('admin', 'developer');

CREATE INDEX IF NOT EXISTS workspace_memberships_user_id_workspace_idx
  ON workspace_memberships (user_id, workspace_id, active);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_memberships_legacy_clerk_unique
  ON workspace_memberships (workspace_id, clerk_user_id)
  WHERE clerk_user_id IS NOT NULL;

UPDATE workspace_audit_events
SET actor_user_id = actor_clerk_user_id
WHERE actor_user_id IS NULL;

UPDATE workspace_audit_events
SET target_user_id = target_clerk_user_id
WHERE target_user_id IS NULL;

ALTER TABLE workspace_audit_events
  ALTER COLUMN actor_user_id SET NOT NULL;

ALTER TABLE workspace_audit_events
  ALTER COLUMN target_user_id SET NOT NULL;

ALTER TABLE workspace_audit_events
  ALTER COLUMN actor_clerk_user_id DROP NOT NULL;

ALTER TABLE workspace_audit_events
  ALTER COLUMN target_clerk_user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS workspace_audit_events_target_user_created_idx
  ON workspace_audit_events (target_user_id, created_at DESC);

UPDATE review_run_retries
SET created_by_user_id = created_by_clerk_user_id
WHERE created_by_user_id IS NULL;

ALTER TABLE review_run_retries
  ALTER COLUMN created_by_user_id SET NOT NULL;

ALTER TABLE review_run_retries
  ALTER COLUMN created_by_clerk_user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS review_run_retries_created_by_user_idx
  ON review_run_retries (created_by_user_id, created_at DESC);
