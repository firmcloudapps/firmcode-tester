# Task 9.0d: Workspace Membership And Role Resolution

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.0, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/LOCAL_DEVELOPMENT.md, docs/PRIVACY_RETENTION.md.
Code context requirement: Before implementing, inspect workspace and membership migrations, dashboard-auth store, settings store/service, billing service, GitHub OAuth store/service, existing role capability helpers, database tests, and any seed/test workspace fixtures.

Implement InsForge-to-Firmcode workspace and membership resolution. For InsForge Organizations, map each InsForge organization to one workspaces row by identity_provider_org_id and map organization memberships to workspace_memberships. Without InsForge Organizations, create or resolve a personal workspace for the InsForge user and give that user Developer role by default.

Define role mapping clearly:
- explicit Firmcode role metadata wins when configured
- InsForge org owner/admin maps to Admin
- InsForge org member maps to Developer
- personal workspace creator maps to Developer unless an internal seed/support flow explicitly grants Admin

Add a request-time ensure/repair path so first login can create or resolve the active workspace without manual seed data. Add InsForge webhook handling or a documented sync boundary for user, organization, and membership changes if the endpoint is not already implemented. Persist updated_at for membership changes and write audit events for elevated role changes.

Testing requirements:
- Add database/service tests for first personal workspace creation.
- Add database/service tests for InsForge organization workspace creation/resolution.
- Add tests for Admin/Developer role mapping.
- Add tests for inactive membership denial.
- Add tests for switching active organization/workspace.
- Add tests for role-change audit events.
- Add tests for idempotent repeated first-login/workspace ensure calls.

Acceptance criteria:
- Authenticated users resolve to one active Firmcode workspace.
- First login works without manual seed data.
- InsForge organization and personal workspace modes are supported.
- Workspace membership roles are deterministic and tested.
- Role changes are auditable.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
