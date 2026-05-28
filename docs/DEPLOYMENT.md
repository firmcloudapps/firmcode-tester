# Deployment Topology

Firmcode uses a hybrid deployment model.

## Production Topology

```text
Vercel
└── Next.js dashboard

Coolify Docker
├── NestJS API
├── Python worker
└── Redis or managed Redis

NeonDB
└── PostgreSQL

Clerk
├── Authentication
├── Organizations / members
└── Billing
```

## Why Hybrid

- Vercel is the best deployment target for the Next.js dashboard, preview deployments, edge caching, Clerk frontend integration, and fast UI iteration.
- Coolify Docker is the right target for API and worker services that need long-running processes, queues, Semgrep, Tree-sitter dependencies, GitHub webhooks, and predictable container runtime behavior.
- NeonDB keeps PostgreSQL managed.
- Clerk keeps SaaS auth, account/profile management, organizations/members where enabled, and billing managed.

## Request Flow

```text
User Browser
  -> Clerk sign-in/session
  -> Vercel Next.js Dashboard
  -> Coolify NestJS API with Clerk bearer token
  -> NeonDB / Redis / GitHub / Worker Artifacts

GitHub Webhook
  -> Coolify NestJS API
  -> Redis Queue
  -> Coolify Python Worker
  -> GitHub Review Comments
```

## Service Responsibilities

### Vercel Web

- Hosts `apps/web`.
- Renders the dashboard.
- Integrates Clerk frontend/session UI.
- Protects dashboard pages and dashboard route handlers with Clerk middleware.
- Sends Clerk session bearer tokens to the API for dashboard calls.
- Renders sign-in/sign-up pages through Clerk components.
- Renders Clerk user menu and organization switcher where enabled.
- Calls the API through `NEXT_PUBLIC_API_URL`.
- Supports preview deployments.
- Does not receive GitHub webhooks.
- Does not run review workers.
- Does not run Semgrep or Tree-sitter analysis.

### Coolify API

- Hosts `apps/api`.
- Receives GitHub webhooks.
- Verifies GitHub signatures.
- Verifies Clerk JWT/session tokens for dashboard APIs.
- Resolves Clerk user/org claims to Firmcode workspace memberships and roles.
- Rejects spoofed user/workspace headers in production.
- Handles CORS for Vercel production, Vercel previews, and local dev.
- Enqueues BullMQ jobs.
- Provides dashboard API endpoints.
- Runs migrations or exposes a migration command.

### Coolify Worker

- Hosts `apps/worker`.
- Consumes review jobs.
- Runs Semgrep.
- Runs Tree-sitter parsing.
- Calls LLM provider.
- Publishes GitHub comments.
- Stores artifacts and findings.

### NeonDB

- Stores application relational state.
- Requires SSL in production.
- Needs connection pooling configured for API and worker.
- Provides the deployed `DATABASE_URL`; keep the `postgres://` or `postgresql://` scheme and database name intact, and set `DATABASE_SSL=true` for API and worker services.

### Clerk

- Configure production and preview callback URLs for the Vercel dashboard.
- Configure sign-in/sign-up, user profile, organization/workspace, member-management, and GitHub OAuth redirect URLs.
- Enable Clerk Billing and expose its subscription portal entry point through `CLERK_BILLING_PORTAL_URL`.
- Provide `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to the web app and `CLERK_SECRET_KEY` to server runtimes that validate sessions or call Clerk server APIs.
- Configure the API token audience/template used by the web app when calling the Coolify API.
- Configure Clerk webhooks for user, organization, and membership changes after the API sync endpoint exists.

### Redis

- Stores BullMQ queues.
- Can be deployed through Coolify or as a managed Redis service.
- Must be reachable by API and worker.

## Local Development

Local development remains Docker-first for the API and worker using Docker Compose, while the web app runs independently with Next.js dev. API and worker use NeonDB through `DATABASE_URL`; Compose does not run a PostgreSQL container.

Every feature that touches API or worker runtime behavior should pass the Docker Compose smoke path before it is considered done. Dashboard changes should pass the local Next.js and Vercel build paths.

Use separate Compose files for local and production:

- `docker-compose.yml`: local backend stack for API, worker, and Redis.
- `docker-compose.prod.yml`: production/Coolify backend stack for API, worker, and internal Redis.

Neither Compose file runs PostgreSQL or the Next.js dashboard. PostgreSQL is NeonDB, and the dashboard deploys to Vercel.

## Required URLs

| Name | Example | Used By |
| --- | --- | --- |
| Web URL | `https://firmcode.example.com` | Clerk redirects, user dashboard |
| API URL | `https://firmcodeapi.firmoncloud.com` | Vercel web, GitHub webhooks |
| GitHub webhook URL | `https://firmcodeapi.firmoncloud.com/webhooks/github` | GitHub App |
| Clerk sign-in URL | `https://firmcode.example.com/sign-in` | Clerk |
| Clerk sign-up URL | `https://firmcode.example.com/sign-up` | Clerk |
| Clerk after-auth URL | `https://firmcode.example.com/auth/redirect` | Clerk |
| Clerk callback URLs | Vercel production and preview URLs | Clerk |
| GitHub OAuth callback URL | `https://firmcode.example.com/api/auth/github/callback` | GitHub App OAuth |
| GitHub App setup URL | `https://firmcode.example.com/github/installations/callback` | GitHub App install/update redirect; enable Redirect on update |

## Authentication Deployment Plan

1. Configure Clerk production instance with sign-in/sign-up URLs, after-auth URLs, organization settings, and Billing.
2. Configure a Clerk API token audience/template, for example `firmcode-api`.
3. Set Vercel web env vars:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `CLERK_JWT_AUDIENCE`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/auth/redirect`
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/auth/redirect`
   - `NEXT_PUBLIC_API_URL=<Coolify API URL>`
   - `CLERK_BILLING_PORTAL_URL`
4. Set Coolify API env vars:
   - `CLERK_SECRET_KEY`
   - `CLERK_JWT_AUDIENCE`
   - `CLERK_WEBHOOK_SECRET` once webhooks are enabled
   - `CORS_ALLOWED_ORIGINS=<Vercel production and approved preview origins>`
5. Run migrations so workspace, membership, GitHub OAuth, audit, and repository tables exist.
6. Deploy API, then web, then test sign-in from the production domain.
7. Confirm a signed-in web request to the API includes an `Authorization` bearer token and the API resolves the correct workspace.
8. Confirm unauthenticated dashboard page access redirects to Clerk.
9. Confirm direct API requests without a valid Clerk token return `401`.
10. Configure Clerk webhooks for organization/user/membership sync after the API endpoint is deployed.

Production must not rely on `FIRMCODE_DASHBOARD_WORKSPACE_ID`, `FIRMCODE_DASHBOARD_CLERK_USER_ID`, or other user-identity headers as authentication.

## CORS Policy

The API must allow:

- production Vercel dashboard domain
- Vercel preview deployment domains if enabled
- local web development URL such as `http://localhost:3000`

The API must not use wildcard CORS in production.

## Deployment Artifacts

Deployment artifacts:

- Vercel project config notes for `apps/web`.
- Coolify service notes for `apps/api`.
- Coolify service notes for `apps/worker`.
- Production Compose file `docker-compose.prod.yml`.
- Production backend Dockerfiles in `infra/docker/*.prod.Dockerfile`.
- Redis deployment notes.
- NeonDB connection notes.
- Migration command notes.

These can live in:

```text
infra/deploy/vercel.md
infra/deploy/coolify.md
```

## Deployment Order

1. Provision NeonDB.
2. Provision Clerk app and billing settings.
3. Provision Redis.
4. Configure Clerk sign-in/sign-up URLs, API token audience/template, and allowed origins.
5. Deploy API to Coolify.
6. Run migrations.
7. Deploy worker to Coolify.
8. Deploy web to Vercel.
9. Verify Clerk route protection and API token verification.
10. Configure Clerk webhooks if membership sync endpoint is deployed.
11. Configure GitHub App webhook URL and GitHub OAuth callback URL.
12. Run dry-run fixture.
13. Enable publishing for one test repository.

## Smoke Checks

- Vercel dashboard loads.
- Clerk sign-in works on Vercel.
- Unauthenticated dashboard access redirects to `/sign-in`.
- Clerk user menu works.
- Clerk organization/workspace switcher works where enabled.
- Vercel dashboard can call Coolify API.
- Dashboard API requests include `Authorization: Bearer <Clerk token>`.
- Direct Coolify dashboard API calls without a Clerk token return `401`.
- Spoofed user/workspace headers cannot impersonate another user.
- Cross-workspace resource requests are denied.
- Admin and Developer role gates match `docs/AUTHORIZATION.md`.
- GitHub OAuth start/callback require a signed-in Clerk user.
- Billing management requires Admin or a verified Clerk Billing capability.
- API health/readiness checks pass.
- Worker is connected to Redis.
- API and worker can reach NeonDB.
- GitHub webhook signature verification passes.
- Synthetic dry-run review completes.
