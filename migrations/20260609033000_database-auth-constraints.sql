UPDATE user_profiles
SET identity_provider = 'insforge',
    provider_user_id = id,
    updated_at = now()
WHERE identity_provider <> 'insforge'
   OR provider_user_id <> id;

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

DELETE FROM workspace_roles
WHERE role NOT IN ('admin', 'developer');

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_identity_provider_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_identity_provider_check CHECK (identity_provider = 'insforge');

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_provider_user_id_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_provider_user_id_check CHECK (provider_user_id = id);

ALTER TABLE workspace_roles
  DROP CONSTRAINT IF EXISTS workspace_roles_role_check;

ALTER TABLE workspace_roles
  ADD CONSTRAINT workspace_roles_role_check CHECK (role IN ('admin', 'developer'));

ALTER TABLE workspace_memberships
  DROP CONSTRAINT IF EXISTS workspace_memberships_user_profile_fk;

ALTER TABLE workspace_memberships
  ADD CONSTRAINT workspace_memberships_user_profile_fk FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE workspace_memberships
  DROP CONSTRAINT IF EXISTS workspace_memberships_role_fk;

ALTER TABLE workspace_memberships
  ADD CONSTRAINT workspace_memberships_role_fk FOREIGN KEY (role) REFERENCES workspace_roles(role);
