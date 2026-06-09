# InsForge Auth Migration Status

Firmcode authentication is InsForge-only. The dashboard receives InsForge session tokens, the API verifies them with `InsForgeTokenVerifier`, and workspace membership/roles are stored in the database.

Current state:

- Auth provider: InsForge.
- User identity: `user_profiles`.
- Workspace membership: `workspace_memberships.user_id`.
- Roles: `workspace_roles`, currently limited to `admin` and `developer`.
- Request context fields: `userId`, `orgId`, `billingCapabilities`, and `provider`.
- Worker codebase scan attribution: `requestedByUserId`.
- Repository and policy update attribution: `updatedByUserId`.

The cleanup migration `016_remove_legacy_identity_columns` copies remaining legacy identity data into generic columns, rebuilds keys/indexes around `user_id`, and drops provider-specific identity columns.

Verification targets:

- `npm run lint --workspace @firmcode/api`
- `npm run test --workspace @firmcode/api -- workspace-resolver.spec.ts billing-api.spec.ts settings-api.spec.ts dashboard-auth-context.spec.ts dashboard-authorization.policy.spec.ts repository-access-scope.spec.ts codebase-scan.store.spec.ts github-dashboard-api.spec.ts`
- `npm run build --workspace @firmcode/shared`
