# Authentication And Authorization

Firmcode is a multi-tenant SaaS product. Clerk handles identity, sessions, organizations, member lifecycle where enabled, and billing. Firmcode owns application authorization, workspace resource ownership, GitHub OAuth connection state, and GitHub installation access rules.

## Identity Model

Firmcode should map Clerk identities to internal workspace records:

- `clerk_user_id`
- `clerk_org_id`
- `workspace_id`
- `role`
- `created_at`
- `updated_at`

If Clerk Organizations are enabled, a Clerk organization maps to one Firmcode workspace. If not enabled for MVP, a user can own a personal workspace.

The workspace is the tenant boundary. Every application row that contains customer data or customer configuration should either belong directly to a workspace or be reachable only through a workspace-owned parent.

## Account Management Requirements

Every SaaS workspace must provide or link to:

- Clerk sign-up and sign-in.
- Clerk user profile management.
- Workspace or organization switching.
- Member invitation/removal/role management through Clerk where available.
- Billing checkout, subscription management, and customer portal through Clerk Billing.
- Required GitHub OAuth connection for each user.
- GitHub App installation management for Owners/Admins.
- Workspace settings for notifications, retention, API keys or disabled API-key state, review policy configuration, and codebase scan cadence.
- Clear disabled states when a feature is unavailable in the MVP.

## Roles

| Role | Capabilities |
| --- | --- |
| Owner | Full access, billing, deletion, GitHub installation management. |
| Admin | Repository settings, review policies, retries, member management where Clerk allows. |
| Developer | View runs/findings, retry failed runs, trigger manual scans where policy allows, inspect artifacts. |
| Viewer | Read-only dashboard access. |

## Permission Rules

- Only Owners/Admins can connect or disconnect GitHub installations.
- Only Owners/Admins can enable/disable repository automation.
- Only Owners/Admins can edit review policies, prompt instructions, retention, and ignored paths.
- Developers can retry failed review runs unless workspace policy disables this.
- Viewers cannot view raw artifacts unless explicitly permitted.
- Billing requires Owner or Clerk-managed billing role.
- Billing UI routes users to the Clerk-managed subscription portal. Firmcode should only cache billing status or usage counters needed for authorization and display; Clerk remains the source of truth for plans, seats, checkout, and subscription management.

## GitHub OAuth Requirement

- Every signed-in Firmcode user must connect a GitHub OAuth account before using GitHub-backed dashboard workflows.
- OAuth identifies the user, supports GitHub username/audit display, and can be used for organization membership checks.
- OAuth does not grant repository review execution by itself. Review, sync, webhook handling, and PR comment publishing must use GitHub App installation tokens.
- Owners/Admins can install or manage GitHub App installations after connecting OAuth. Developers/Viewers connect OAuth but cannot install, disconnect, or rescope GitHub App installations unless their workspace role changes.

## GitHub Installation Mapping

Each GitHub installation must be mapped to a workspace. API requests must verify:

- Clerk session is valid.
- User belongs to the workspace.
- Workspace owns or is allowed to access the GitHub installation.
- Repository belongs to that installation.

## API Authorization

Every dashboard API should enforce workspace access by `workspace_id`. Do not trust repository IDs, review run IDs, or finding IDs without checking ownership.

Codebase scan run and finding APIs must enforce ownership through the scan run repository and GitHub installation workspace before exposing scan artifacts, unresolved repository findings, or review enrichment data.

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
