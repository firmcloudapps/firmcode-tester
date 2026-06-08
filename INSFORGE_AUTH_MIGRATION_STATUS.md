# InsForge Auth Migration Status

## Completed Changes

### Database Layer
- ✅ All 12 original migrations applied to InsForge
- ✅ Migration 013 created and applied (generic identity columns)
- ✅ Storage bucket `review-artifacts` created

### Configuration Layer
- ✅ Root `.env.example` updated with provider selection
- ✅ `apps/api/.env.example` updated
- ✅ `apps/worker/.env.example` updated  
- ✅ `apps/web/.env.example` updated
- ✅ `docker-compose.yml` updated with new env vars
- ✅ `packages/shared/src/config/runtime.ts` updated with:
  - `DatabaseProvider`, `AuthProvider`, `StorageProvider` types
  - `AuthConfig`, `StorageConfig`, `InsForgeConfig` interfaces
  - Updated `ApiRuntimeConfig` with `auth` and `storage` properties
  - New config reader functions

### New Files Created
- ✅ `apps/api/src/modules/auth/token-verifier.ts` - Generic token verification interface
- ✅ `apps/api/src/modules/auth/insforge-token-verifier.ts` - InsForge JWT verifier

### Auth Layer Updates (Partial)
- ✅ `clerk-token-verifier.ts` - Updated to implement generic `TokenVerifier`
- ✅ `dashboard-auth.context.ts` - Updated with generic `userId`, `orgId`, `provider` fields
- ✅ `dashboard-auth.guard.ts` - Updated to use generic `TokenVerifier`
- ✅ `repository-access-scope.ts` - Updated to accept generic `userId`
- ✅ `dashboard-auth.store.ts` - Updated `DashboardMembership` with `userId`
- ✅ `workspace-resolver.ts` - Partially updated (interface and main resolve method)

## Remaining Work (Critical)

### workspace-resolver.ts - Complete Remaining Updates
The file still has many references to `clerkUserId` that need updating:

1. **ensureMembership method** (lines 226-275):
   - SQL queries still use `clerk_user_id` columns
   - Need to add `user_id` column support
   - Update audit events to use generic `actor_user_id`

2. **findActiveMembership method** (lines 277-291):
   - Query only uses `clerk_user_id`
   - Should also check `user_id` column

3. **findMembership method** (lines 293-306):
   - Query only uses `clerk_user_id`
   - Should also check `user_id` column

4. **auditRoleChangeIfElevated method** (lines 308-344):
   - Uses `actor_clerk_user_id`, `target_clerk_user_id`
   - Should use generic `actor_user_id`, `target_user_id`

5. **Helper functions** (lines 345-421):
   - All functions reference `VerifiedClerkToken` instead of `VerifiedToken`
   - `toResolvedWorkspace` needs to return `userId`, `orgId`

### Dashboard Auth Module
- ✅ `dashboard-auth.module.ts` - Needs to provide correct verifier based on AUTH_PROVIDER

### Web Layer
- ⬜ Install `@insforge/sdk@latest`
- ⬜ Create `apps/web/lib/insforge.ts`
- ⬜ Create auth provider components for InsForge

### Worker Layer
- ⬜ Add storage upload helper

## Next Steps

To complete the auth migration:

1. **Finish workspace-resolver.ts updates** - The most critical remaining work
2. **Update dashboard-auth.module.ts** to conditionally provide Clerk vs InsForge verifiers
3. **Build and test** the API changes
4. **Install InsForge SDK** in web app and create auth components

## Database Schema Notes

The schema now supports both Clerk and InsForge:

```sql
-- Workspaces can be identified by either clerk_org_id OR identity_provider_org_id
workspaces.clerk_org_id (nullable)
workspaces.identity_provider_org_id (nullable)  
workspaces.identity_provider ('clerk' | 'insforge')

-- Memberships support both clerk_user_id AND user_id
workspace_memberships.clerk_user_id (nullable)
workspace_memberships.user_id (nullable)
```

The API code should:
1. Try to match on `user_id` first (InsForge)
2. Fall back to `clerk_user_id` (Clerk)
3. When creating new memberships, set both columns
