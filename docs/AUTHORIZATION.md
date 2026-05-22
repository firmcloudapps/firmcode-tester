# Authentication And Authorization

Clerk handles identity, sessions, organizations, and billing. Firmcode owns application authorization and GitHub installation access rules.

## Identity Model

Firmcode should map Clerk identities to internal workspace records:

- `clerk_user_id`
- `clerk_org_id`
- `workspace_id`
- `role`
- `created_at`
- `updated_at`

If Clerk Organizations are enabled, a Clerk organization maps to one Firmcode workspace. If not enabled for MVP, a user can own a personal workspace.

## Roles

| Role | Capabilities |
| --- | --- |
| Owner | Full access, billing, deletion, GitHub installation management. |
| Admin | Repository settings, review policies, retries, member management where Clerk allows. |
| Developer | View runs/findings, retry failed runs, inspect artifacts. |
| Viewer | Read-only dashboard access. |

## Permission Rules

- Only Owners/Admins can connect or disconnect GitHub installations.
- Only Owners/Admins can enable/disable repository automation.
- Only Owners/Admins can edit review policies, prompt instructions, retention, and ignored paths.
- Developers can retry failed review runs unless workspace policy disables this.
- Viewers cannot view raw artifacts unless explicitly permitted.
- Billing requires Owner or Clerk-managed billing role.
- Billing UI routes users to the Clerk-managed subscription portal. Firmcode should only cache billing status or usage counters needed for authorization and display; Clerk remains the source of truth for plans, seats, checkout, and subscription management.

## GitHub Installation Mapping

Each GitHub installation must be mapped to a workspace. API requests must verify:

- Clerk session is valid.
- User belongs to the workspace.
- Workspace owns or is allowed to access the GitHub installation.
- Repository belongs to that installation.

## API Authorization

Every dashboard API should enforce workspace access by `workspace_id`. Do not trust repository IDs, review run IDs, or finding IDs without checking ownership.

## Webhook Authorization

GitHub webhooks are not Clerk-authenticated. They must be authorized by:

- signature verification
- installation ID allowlist where configured
- repository installation ownership lookup
- event idempotency check

## Audit Events

Persist audit events for:

- GitHub installation connected/disconnected
- repository enabled/disabled
- policy changed
- dry run changed
- billing plan changed webhook
- review run retried
- artifact viewed if raw artifacts are sensitive
