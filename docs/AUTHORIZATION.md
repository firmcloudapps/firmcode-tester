# Authentication And Authorization

Firmcode is a multi-tenant SaaS product. Clerk handles identity, sessions, organizations, member lifecycle where enabled, and billing. Firmcode owns application authorization, workspace resource ownership, GitHub OAuth connection state, and GitHub installation access rules.

## Complete Authentication Flow Implementation Plan

The MVP must ship with real Clerk-backed authentication before any dashboard data is considered protected. Environment-provided user/workspace headers are only a local test shim and must not be accepted as the production authentication path.

### Web Application

- Install `@clerk/nextjs` in `apps/web`.
- Replace the no-op Clerk provider boundary with `ClerkProvider`.
- Add Clerk pages:
  - `/sign-in/[[...sign-in]]`
  - `/sign-up/[[...sign-up]]`
- Add Next.js middleware using Clerk route matching:
  - Protect every dashboard page: `/`, `/repositories`, `/repositories/:path*`, `/review-runs/:path*`, `/findings`, `/pull-requests/:path*`, `/ci-failures/:path*`, `/rules`, `/settings`, `/billing`, and `/github/installations`.
  - Protect dashboard API proxy routes under `/api/*` except any intentionally public health/static routes.
  - Keep GitHub OAuth callback routes protected because the returning browser session is required to bind the OAuth state to the signed-in Clerk user.
- Update the dashboard shell:
  - Use `UserButton` for the account menu.
  - Use `OrganizationSwitcher` when Clerk Organizations are enabled.
  - Show the active Clerk organization or personal workspace name instead of static placeholder text.
  - Redirect unauthenticated users to `/sign-in`.
- Replace environment-provided dashboard identity forwarding with Clerk server auth:
  - Server components and route handlers call Clerk `auth()`.
  - Route handlers obtain a Clerk session token with the configured API audience/template.
  - Calls from web to API include `Authorization: Bearer <clerk-session-token>`.
  - Optional workspace selection is conveyed as `x-firmcode-workspace-id` or query/body input only after the API has verified the Clerk token and confirmed membership. The user ID must always come from Clerk claims, never from a client-provided header.

### API Application

- Install Clerk's server-side verification package, such as `@clerk/backend`, in `apps/api`.
- Add an API auth module with:
  - A Nest guard for dashboard routes.
  - Clerk JWT/session token verification against Clerk issuer/JWKS or the Clerk backend SDK.
  - Request context containing `clerkUserId`, `clerkOrgId`, `sessionId`, `workspaceId`, `role`, and derived capabilities.
  - Shared decorators/helpers for controllers to require membership and capabilities.
- Apply the guard to every dashboard API:
  - repositories
  - repository configuration and activity
  - pull requests
  - review runs and raw artifacts
  - findings
  - CI failures
  - rules/policies
  - settings
  - billing
  - GitHub OAuth/install/sync endpoints
  - codebase scan dashboard actions
- Do not apply Clerk auth to GitHub webhook endpoints. Webhooks remain protected by GitHub signature verification and installation ownership lookup.
- Remove controller-level trust in `x-firmcode-user-id`. That header may exist only in tests. Production identity must be read from the verified Clerk token.
- Keep `x-firmcode-workspace-id` as an optional workspace selector only if the verified Clerk user belongs to that workspace. If omitted, resolve from the active Clerk organization claim or the user's personal workspace.
- Return:
  - `401` when the Clerk token is missing, expired, malformed, or invalid.
  - `403` when the user is authenticated but lacks the role/capability.
  - `404` when the resource is outside the caller workspace and revealing existence would leak tenant data.

### Workspace And Role Resolution

- Clerk Organizations enabled:
  - Map each Clerk organization to one `workspaces` row by `clerk_org_id`.
  - Map Clerk organization memberships to `workspace_memberships`.
  - Treat Clerk organization roles as authoritative when Organizations are optional and active: `org:admin`/`admin` and legacy `org:owner`/`owner` resolve to Admin; `org:member`/`member` and `org:developer`/`developer` resolve to Developer.
  - Optional trusted Firmcode role metadata is only a fallback when no recognized Clerk organization role is present. The API reads `firmcode_role`, `org_firmcode_role`, `firmcode.role`, `organization_metadata.firmcode_role`, `public_metadata.firmcode_role`, or `metadata.firmcode_role`.
- Clerk Organizations disabled:
  - Create one personal workspace per Clerk user.
  - All frontend signups default to Developer.
  - Admin is granted by setting trusted Clerk user metadata such as `firmcode_role=admin` and exposing it in the Clerk session token. The API syncs that claim into `workspace_memberships` on the next authenticated request.
- Sync membership from Clerk webhooks and also repair/ensure the active workspace on authenticated requests so first login does not require manual seed data.
- Persist role changes with `updated_at`, allow Admins to assign Admin/Developer roles or suspend/restore workspace accounts in Settings, and write audit events for Admin grants or removals.

Current sync boundary: until a dedicated Clerk webhook endpoint is added, authenticated API requests are the repair boundary for the active personal or organization workspace. Request-time resolution creates missing personal/org workspace rows, creates missing active memberships, updates role changes derived from trusted Clerk organization claims, refuses memberships already marked inactive, and writes `workspace_audit_events` for Admin grants/removals. Clerk user, organization, and membership deletion/deactivation events must be reflected by an internal support/admin sync or the future Clerk webhook before the next request; the resolver will not reactivate an inactive membership.

### Authenticated Request Flow

```text
Browser
  -> Clerk hosted/session UI
  -> Next.js middleware verifies route access
  -> Next.js server component/route handler reads Clerk auth()
  -> Next.js sends Authorization: Bearer <Clerk token> to API
  -> NestJS Clerk guard verifies token
  -> Workspace resolver maps Clerk user/org to Firmcode workspace
  -> Capability guard checks Admin/Developer permissions
  -> Controller/service checks resource ownership by workspace_id
  -> Response contains only tenant-scoped, role-allowed data
```

### Required Auth Pages And Routes

| Route | Requirement |
| --- | --- |
| `/sign-in/[[...sign-in]]` | Clerk sign-in page. |
| `/sign-up/[[...sign-up]]` | Clerk sign-up page. |
| `/` | Protected dashboard overview or redirect to sign-in. |
| `/github/installations` | Protected setup page; requires Clerk auth, then GitHub OAuth for GitHub-backed workflows. |
| `/auth/github` | Protected route that starts GitHub OAuth for the signed-in Clerk user. |
| `/api/auth/github/callback` | Protected route that completes GitHub OAuth for the signed-in Clerk user and validates OAuth state. |

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

Firmcode uses a deliberately small SaaS role model for the MVP:

- `admin`
- `developer`

Do not introduce Owner, Viewer, maintainer, auditor, or custom workspace roles for MVP unless the product requirements change. Extra roles create billing, support, and authorization branches that are not needed for the initial revenue-focused developer dashboard.

## Account Management Requirements

Every SaaS workspace must provide or link to:

- Clerk sign-up and sign-in.
- Clerk user profile management.
- Workspace or organization switching.
- Member invitation/removal through Clerk where available.
- Billing checkout, subscription management, and customer portal through Clerk Billing.
- Required GitHub OAuth connection for each user.
- GitHub App installation and repository management.
- Workspace settings for notifications, retention, API keys or disabled API-key state, review policy configuration, and codebase scan cadence.
- Clear disabled states when a feature is unavailable in the MVP.

## Roles

| Role | Capabilities |
| --- | --- |
| Admin | Platform/workspace administration: manage billing, plans, members where Clerk allows, workspace settings, retention, API keys, global policies, support/debug access, and safety overrides. Admins can also do everything Developers can do. |
| Developer | Primary customer role: connect GitHub OAuth, install/connect GitHub App where plan allows, add/sync repositories, enable PR review automation, run/retry reviews, trigger scans, configure repository-level review settings, and view reports, findings, CI failure analysis, and redacted artifacts for their workspace. |

## Permission Rules

- Admins can manage billing, plans, member access where Clerk allows, data retention, API keys, global workspace policies, and destructive workspace actions.
- Developers can connect GitHub OAuth, install/connect GitHub App for their workspace where plan allows, add/sync repositories, enable/disable repository automation, edit repository-level review settings, retry failed review runs, trigger manual scans, and view report analysis.
- Global workspace policy changes that affect billing, retention, API keys, or all repositories require Admin.
- Raw artifact access is allowed for Admin and can be allowed for Developer only through a redacted artifact flow. Plain raw logs, private diffs, and tokens must not be exposed by default.
- Billing requires Admin or a verified Clerk-managed billing capability.
- Billing UI routes users to the Clerk-managed subscription portal. Firmcode should only cache billing status or usage counters needed for authorization and display; Clerk remains the source of truth for plans, seats, checkout, and subscription management.

## GitHub OAuth Requirement

- Every signed-in Firmcode user must connect a GitHub OAuth account before using GitHub-backed dashboard workflows.
- OAuth identifies the user, supports GitHub username/audit display, and can be used for organization membership checks.
- OAuth does not grant repository review execution by itself. Review, sync, webhook handling, and PR comment publishing must use GitHub App installation tokens.
- Developers can connect GitHub OAuth and add GitHub repositories through the app setup flow. Admins can also manage workspace-wide installation, billing, member, and policy controls.

## GitHub Installation Mapping

Each GitHub installation must be mapped to a workspace. API requests must verify:

- Clerk session is valid.
- User belongs to the workspace.
- Workspace owns or is allowed to access the GitHub installation.
- Repository belongs to that installation.

## API Authorization

Every dashboard API should enforce workspace access by `workspace_id`. Do not trust repository IDs, review run IDs, or finding IDs without checking ownership.

Codebase scan run and finding APIs must enforce ownership through the scan run repository and GitHub installation workspace before exposing scan artifacts, unresolved repository findings, or review enrichment data.

Production dashboard APIs must not accept caller identity from `x-firmcode-user-id`, `FIRMCODE_DASHBOARD_CLERK_USER_ID`, or any equivalent client-controlled value. Isolated web tests may use `FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN` as a clearly named bearer-token fixture, but it must not be treated as production auth. Direct controller unit tests may still pass legacy workspace/user strings only under `NODE_ENV=test`; the same fallback throws `401` outside tests.

## Implementation Acceptance Criteria

- Unauthenticated users visiting any dashboard page are redirected to Clerk sign-in.
- Authenticated users without a workspace receive an onboarding/personal-workspace creation path, not raw dashboard data.
- Dashboard API requests without a valid Clerk token return `401`.
- A valid Clerk user can access only resources owned by their resolved workspace.
- Cross-workspace repository, review run, finding, CI failure, artifact, billing, settings, and policy requests are denied.
- Admin/Developer capabilities match the role table in this document.
- Billing management requires Admin or a verified Clerk Billing capability.
- GitHub OAuth cannot start or complete without a signed-in Clerk user and workspace membership.
- GitHub App installation and repository connection require a connected GitHub OAuth account and an active Admin or Developer workspace membership, subject to plan limits.
- Raw artifact access is role-gated and audited.
- Tests cover sign-in route protection, API token verification, workspace resolution, role denial, cross-workspace denial, and spoofed-header rejection.

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
