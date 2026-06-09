# InsForge Migration Status

Firmcode is configured to use InsForge for authentication and backend identity. New application code must use provider-neutral user IDs and database-managed workspace roles.

Completed:

- Web auth flow uses the InsForge SDK.
- API auth guard depends on `InsForgeTokenVerifier`.
- Dashboard context exposes generic identity fields only.
- Database-managed profiles and roles exist in `user_profiles`, `workspace_memberships`, and `workspace_roles`.
- Workspace roles are restricted to `admin` and `developer`.
- Worker queue contracts use `requestedByUserId`.
- Settings, billing, GitHub, repository configuration, rules, and codebase scan paths use generic user attribution.

Pending only when operating an already-provisioned database:

- Apply migration `016_remove_legacy_identity_columns`.
- Rebuild containers after migration so the API starts against the generic schema.
