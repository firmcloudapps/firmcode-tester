# Authentication And Authorization

Firmcode uses InsForge for identity and sessions. Firmcode owns application authorization, workspace membership, roles, GitHub OAuth connection state, GitHub installation access rules, and audit events in its PostgreSQL database.

InsForge has been removed from the active auth path. Remaining `insforge_*` column names are compatibility aliases for historical data and should not be used as the source of truth for new authorization logic.

## Request Flow

```text
Browser
  -> InsForge auth session
  -> Next.js protected route or route handler
  -> Next.js sends Authorization: Bearer <InsForge token> to API
  -> NestJS dashboard guard verifies the token
  -> Workspace resolver upserts user_profiles
  -> Workspace resolver finds or creates workspace_memberships
  -> Capability checks use the role stored in workspace_memberships
  -> Controller/service checks tenant ownership by workspace_id
```

Dashboard APIs must reject caller-provided user identity. `x-firmcode-user-id` is not accepted in production. `x-firmcode-workspace-id` may select a workspace only after the API verifies that the authenticated user has an active membership in that workspace.

## Database Identity Model

The database-owned auth model is:

- `user_profiles`: one row per authenticated InsForge user. The primary key is the canonical `user_id` from the verified token. The resolver refreshes email, verification state, provider, metadata, and `last_seen_at` on authenticated requests.
- `workspace_roles`: the allowed workspace roles and their capability metadata.
- `workspace_memberships`: the tenant membership and role assignment table. `user_id` is required and references the authenticated user profile. `role` references `workspace_roles`.
- `workspace_audit_events`: records elevated role grants/removals and other security-sensitive workspace changes using canonical `actor_user_id` and `target_user_id`.

Compatibility columns such as `workspace_memberships.user_id`, `workspaces.identity_provider_org_id`, and `workspace_audit_events.actor_user_id` may remain nullable while historical queries are cleaned up. New code should write and read the generic `user_id`, `orgId`, and `provider` fields.

## Role Rules

Firmcode currently supports these workspace roles:

| Role | Purpose |
| --- | --- |
| `admin` | Manages workspace settings, billing context, GitHub installations, sensitive policies, and member access. |
| `developer` | Runs review workflows, manages repository-level configuration, triggers scans, and triages findings. |

Roles are database-owned. InsForge token role metadata may seed a newly created membership when explicitly handled by the resolver, but an existing `workspace_memberships.role` row must not be silently overwritten by token claims. Admin promotion, demotion, suspension, or restore should happen through a trusted settings/support/admin path and must write audit events.

The removed InsForge-era roles are normalized during migration: `owner` becomes `admin`, and `viewer` becomes `developer`. New rows must use only `admin` or `developer`.

## Permission Rules

- Missing, malformed, expired, or invalid InsForge bearer tokens return `401`.
- Authenticated users without active workspace membership return `403` or `404` depending on whether disclosing resource existence would leak tenant data.
- Every customer-owned row must be scoped directly by `workspace_id` or through a workspace-owned parent.
- Cross-workspace repository, review run, finding, CI failure, artifact, billing, settings, and policy reads must be denied.
- Global workspace policy, billing, retention, API key, member, and support/safety mutations require Admin.
- Repository-level review policy and repository configuration mutations may be available to Developers when the capability matrix allows it.
- Raw artifacts must stay role-gated and should prefer redacted summaries for lower-risk dashboard views.

## GitHub Authorization

Every user must connect GitHub OAuth before using GitHub-backed dashboard workflows. OAuth identifies the dashboard user and supports per-user audit or author matching. It does not grant repository review execution by itself.

Review execution, repository sync, webhook handling, and PR comment publishing must use GitHub App installation tokens. Each GitHub installation must be mapped to one Firmcode workspace, and every GitHub dashboard endpoint must verify workspace ownership before returning or mutating installation or repository data.

GitHub webhooks are not InsForge-authenticated. They must be authorized by GitHub signature verification, installation ownership lookup, and event idempotency checks.

## Acceptance Criteria

- Authenticated requests create or refresh `user_profiles`.
- First-login workspace resolution creates an active `workspace_memberships` row when appropriate.
- Existing database roles are preserved across requests even when token metadata changes.
- Admin role grants and removals are audited.
- Dashboard API tests cover missing token, spoofed user header rejection, workspace membership denial, cross-workspace denial, role denial, and first-login profile/membership creation.
