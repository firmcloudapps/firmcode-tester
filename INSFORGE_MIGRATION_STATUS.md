# InsForge Migration Status

## Completed

### Database Layer (Phase 1)
- ✅ All 12 existing migrations applied to InsForge PostgreSQL database
- ✅ Migration 013 created: `generalize_identity_columns.ts` - adds provider-agnostic columns
- ✅ Migration 013 registered in `migrations.ts`
- ✅ Schema migrations tracking table created in InsForge
- ✅ InsForge storage bucket `review-artifacts` created

### Configuration Layer
- ✅ Updated `.env.example` (root) with provider selection vars:
  - `DATABASE_PROVIDER=neon|insforge`
  - `AUTH_PROVIDER=clerk|insforge`
  - `STORAGE_PROVIDER=database|insforge`
  - InsForge connection variables (`INSFORGE_DATABASE_URL`, `INSFORGE_BASE_URL`, etc.)
- ✅ Updated `apps/api/.env.example` with same options
- ✅ Updated `apps/worker/.env.example` with database/storage options
- ✅ Updated `apps/web/.env.example` with auth/InsForge options
- ✅ Updated `docker-compose.yml` with all provider environment variables

### Shared Package (`packages/shared/src/config/runtime.ts`)
- ✅ Added `DatabaseProvider`, `AuthProvider`, `StorageProvider` types
- ✅ Updated `DatabaseConfig` interface with provider field and InsForge options
- ✅ Added `AuthConfig`, `StorageConfig`, `InsForgeConfig`, `DefaultWorkspaceConfig` interfaces
- ✅ Updated `ApiRuntimeConfig` with `auth` and `storage` properties
- ✅ Added `readDatabaseProvider()`, `readAuthProvider()` functions
- ✅ Updated `readDatabaseConfig()` to handle provider switching
- ✅ Added `readAuthConfig()`, `readInsForgeConfig()`, `readDefaultWorkspaceConfig()`, `readStorageConfig()` functions
- ✅ Updated `readDatabaseSsl()` to handle InsForge SSL requirements
- ✅ Updated `createApiRuntimeConfig()` to use new config structure

## Schema Changes (Migration 013)

New provider-agnostic columns added alongside Clerk-specific ones:

| Table | New Column | Purpose |
|-------|------------|---------|
| `workspaces` | `identity_provider` | 'clerk' or 'insforge' |
| `workspaces` | `identity_provider_org_id` | Generic org identifier |
| `workspace_memberships` | `user_id` | InsForge user ID |
| `review_run_retries` | `created_by_user_id` | Generic actor ID |
| `workspace_audit_events` | `actor_user_id`, `target_user_id` | Generic actor/target |
| `codebase_scan_finding_status_events` | `actor_user_id` | Generic actor ID |
| `repository_review_configurations` | `updated_by_user_id` | Generic updater ID |
| `review_policies` | `updated_by_user_id` | Generic updater ID |
| `github_oauth_connections` | `user_id` | Generic user ID |
| `github_oauth_states` | `user_id` | Generic user ID |
| `repository_access` | `user_id`, `granted_by_user_id` | Generic user IDs |

## Next Steps (Remaining Work)

### 1. API Layer Updates (`apps/api`)

#### Database Connection Adapter
- Update `pull-requests.module.ts` and other modules to use `database.provider` for connection selection
- Create `InsForgeDatabasePool` adapter if direct PostgreSQL connection not available

#### Authentication
- Create `InsForgeJwtGuard` to replace/augment `ClerkGuard`
- Update `DashboardRequestContext` to use generic `userId` instead of `clerkUserId`
- Create workspace provisioning endpoint for InsForge auth flow
- Remove or make optional `ClerkWebhookModule` when `AUTH_PROVIDER=insforge`

#### Storage
- Create storage adapter interface
- Implement `InsForgeStorageAdapter` for artifact uploads
- Implement `DatabaseStorageAdapter` (existing JSONB approach)

### 2. Web Layer Updates (`apps/web`)

#### Authentication
- Install `@insforge/sdk@latest`
- Create `lib/insforge.ts` client singleton
- Replace Clerk components when `AUTH_PROVIDER=insforge`
- Update sign-in/sign-up pages

### 3. Worker Updates (`apps/worker`)

- Add storage upload helper using InsForge REST API
- Update artifact saving logic to use storage adapter

## Usage

### Switch to InsForge (Database Only)
```bash
# .env.local
DATABASE_PROVIDER=insforge
INSFORGE_DATABASE_URL=postgresql://...
# Keep AUTH_PROVIDER=clerk to continue using Clerk auth
```

### Full InsForge Migration
```bash
# .env.local
DATABASE_PROVIDER=insforge
INSFORGE_DATABASE_URL=postgresql://...
AUTH_PROVIDER=insforge
STORAGE_PROVIDER=insforge
INSFORGE_STORAGE_BUCKET=review-artifacts
```

### Stay on NeonDB + Clerk (Default)
```bash
# .env.local (no changes needed)
DATABASE_PROVIDER=neon
AUTH_PROVIDER=clerk
STORAGE_PROVIDER=database
```
