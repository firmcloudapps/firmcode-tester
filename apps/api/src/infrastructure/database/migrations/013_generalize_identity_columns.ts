import type { DatabaseMigration } from "../migrations";

/**
 * Migration 013: Generalize identity columns for multi-provider auth
 * 
 * This migration adds provider-agnostic columns alongside Clerk-specific ones
 * to support InsForge auth as an alternative authentication provider.
 * 
 * When AUTH_PROVIDER=insforge:
 * - user_id contains InsForge user IDs (usr_...)
 * - identity_provider_org_id contains workspace identifiers
 * 
 * When AUTH_PROVIDER=clerk (legacy):
 * - clerk_user_id contains Clerk user IDs
 * - clerk_org_id contains Clerk organization IDs
 */
export const generalizeIdentityColumnsMigration: DatabaseMigration = {
  id: "013_generalize_identity_columns",
  name: "generalize identity columns for multi-provider auth",
  sql: `
-- Add provider-agnostic user_id column alongside clerk_user_id
ALTER TABLE workspace_memberships
  ADD COLUMN IF NOT EXISTS user_id text;

-- Add provider-agnostic actor_user_id/target_user_id columns
ALTER TABLE review_run_retries
  ADD COLUMN IF NOT EXISTS created_by_user_id text;

ALTER TABLE workspace_audit_events
  ADD COLUMN IF NOT EXISTS actor_user_id text,
  ADD COLUMN IF NOT EXISTS target_user_id text;

ALTER TABLE codebase_scan_finding_status_events
  ADD COLUMN IF NOT EXISTS actor_user_id text;

ALTER TABLE repository_review_configurations
  ADD COLUMN IF NOT EXISTS updated_by_user_id text;

ALTER TABLE review_policies
  ADD COLUMN IF NOT EXISTS updated_by_user_id text;

ALTER TABLE github_oauth_connections
  ADD COLUMN IF NOT EXISTS user_id text;

ALTER TABLE github_oauth_states
  ADD COLUMN IF NOT EXISTS user_id text;

-- Update repository_access to have generic user_id
ALTER TABLE repository_access
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS granted_by_user_id text;

-- Add identity_provider column to workspaces
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS identity_provider text DEFAULT 'clerk';

-- Add generic identity_provider_org_id alongside clerk_org_id
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS identity_provider_org_id text;

-- Create unique index on the generic org_id
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_identity_provider_org_id_unique 
  ON workspaces (identity_provider_org_id) 
  WHERE identity_provider_org_id IS NOT NULL;
`
};
