import type { DatabaseMigration } from "../migrations";

export const adminDeveloperRolesOnlyMigration: DatabaseMigration = {
  id: "015_admin_developer_roles_only",
  name: "retain only admin and developer workspace roles",
  sql: `
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

ALTER TABLE workspace_memberships
  DROP CONSTRAINT IF EXISTS workspace_memberships_role_check;

ALTER TABLE workspace_memberships
  ADD CONSTRAINT workspace_memberships_role_check CHECK (role IN ('admin', 'developer'));

ALTER TABLE workspace_audit_events
  DROP CONSTRAINT IF EXISTS workspace_audit_events_previous_role_check;

ALTER TABLE workspace_audit_events
  ADD CONSTRAINT workspace_audit_events_previous_role_check CHECK (previous_role IS NULL OR previous_role IN ('admin', 'developer'));

ALTER TABLE workspace_audit_events
  DROP CONSTRAINT IF EXISTS workspace_audit_events_next_role_check;

ALTER TABLE workspace_audit_events
  ADD CONSTRAINT workspace_audit_events_next_role_check CHECK (next_role IS NULL OR next_role IN ('admin', 'developer'));

DELETE FROM workspace_roles
WHERE role NOT IN ('admin', 'developer');
`
};
