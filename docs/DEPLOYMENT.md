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

InsForge
├── Authentication
├── OAuth / email verification
└── User profiles
```

## Why Hybrid

- Vercel is the best deployment target for the Next.js dashboard, preview deployments, edge caching, InsForge frontend integration, and fast UI iteration.
- Coolify Docker is the right target for API and worker services that need long-running processes, queues, Semgrep, Tree-sitter dependencies, GitHub webhooks, and predictable container runtime behavior.
- NeonDB keeps PostgreSQL managed.
- InsForge keeps SaaS auth, account/profile management, OAuth, and email verification managed.

## Request Flow

```text
User Browser
  -> InsForge sign-in/session
  -> Vercel Next.js Dashboard
  -> Coolify NestJS API with InsForge bearer token
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
- Integrates InsForge frontend/session UI.
- Renders sign-in/sign-up pages through InsForge auth components.
- Sends InsForge bearer tokens to the API for dashboard calls.
- Renders InsForge-backed account controls.
- Calls the API through `NEXT_PUBLIC_API_URL`.
- Supports preview deployments.
- Does not receive GitHub webhooks.
- Does not run review workers.
- Does not run Semgrep or Tree-sitter analysis.

### Coolify API

- Hosts `apps/api`.
- Receives GitHub webhooks.
- Verifies GitHub signatures.
- Verifies InsForge JWT/session tokens for dashboard APIs.
- Resolves InsForge user/org claims to Firmcode workspace memberships and roles.
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

### InsForge Auth

- Configure production and preview allowed redirect URLs for the Vercel dashboard in InsForge.
- Enable email/password auth and Google OAuth if the Google button should be available.
- Provide `NEXT_PUBLIC_INSFORGE_BASE_URL`, `NEXT_PUBLIC_INSFORGE_URL`, and `NEXT_PUBLIC_INSFORGE_ANON_KEY` to the web app.
- Provide `INSFORGE_BASE_URL` and `INSFORGE_ANON_KEY` to web server runtimes that validate sessions during redirects/server rendering.
- Provide `AUTH_PROVIDER=insforge` to the API and web runtimes.

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
| Web URL | `https://firmcode.example.com` | InsForge redirects, user dashboard |
| API URL | `https://firmcodeapi.firmoncloud.com` | Vercel web, GitHub webhooks |
| GitHub webhook URL | `https://firmcodeapi.firmoncloud.com/webhooks/github` | GitHub App |
| InsForge sign-in URL | `https://firmcode.example.com/sign-in` | InsForge |
| InsForge sign-up URL | `https://firmcode.example.com/sign-up` | InsForge |
| InsForge after-auth URL | `https://firmcode.example.com/auth/redirect` | InsForge |
| InsForge allowed redirect URLs | Vercel production and preview URLs | InsForge |
| GitHub OAuth callback URL | `https://firmcode.example.com/api/auth/github/callback` | GitHub App OAuth |
| GitHub App setup URL | `https://firmcode.example.com/github/installations/callback` | GitHub App install/update redirect; enable Redirect on update |

## Authentication Deployment Plan

1. Configure the InsForge production project with email/password auth, allowed redirect URLs, and optional Google OAuth.
2. Confirm the InsForge anon key is safe to expose as `NEXT_PUBLIC_INSFORGE_ANON_KEY`.
3. Set Vercel web env vars:
   - `AUTH_PROVIDER=insforge`
   - `NEXT_PUBLIC_AUTH_PROVIDER=insforge`
   - `INSFORGE_BASE_URL=<InsForge backend URL>`
   - `INSFORGE_ANON_KEY=<InsForge anon key>`
   - `NEXT_PUBLIC_INSFORGE_BASE_URL=<InsForge backend URL>`
   - `NEXT_PUBLIC_INSFORGE_URL=<InsForge backend URL>`
   - `NEXT_PUBLIC_INSFORGE_ANON_KEY=<InsForge anon key>`
   - `NEXT_PUBLIC_INSFORGE_AFTER_SIGN_IN_URL=/auth/redirect`
   - `NEXT_PUBLIC_INSFORGE_AFTER_SIGN_UP_URL=/auth/redirect`
   - `API_URL=<Coolify API URL>`
   - `NEXT_PUBLIC_API_URL=<Coolify API URL>` when a public API fallback is needed
4. Set Coolify API env vars:
   - `AUTH_PROVIDER=insforge`
   - `INSFORGE_BASE_URL=<InsForge backend URL>`
   - `INSFORGE_ANON_KEY=<InsForge anon key>`
   - `CORS_ALLOWED_ORIGINS=<Vercel production and approved preview origins>`
5. Run migrations so workspace, membership, GitHub OAuth, audit, and repository tables exist.
6. Deploy API, then web, then test sign-in from the production domain.
7. Confirm a signed-in web request to the API includes an `Authorization` bearer token and the API resolves the correct workspace.
8. Confirm `/auth/redirect` routes signed-in users to the role-appropriate dashboard.
9. Confirm direct API requests without a valid InsForge token return `401`.

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
2. Provision the InsForge project and auth settings.
3. Provision Redis.
4. Configure InsForge allowed redirect URLs and optional Google OAuth.
5. Deploy API to Coolify.
6. Run migrations.
7. Deploy worker to Coolify.
8. Deploy web to Vercel.
9. Verify InsForge sign-in, `/auth/redirect`, and API token verification.
10. Configure GitHub App webhook URL and GitHub OAuth callback URL.
11. Run dry-run fixture.
12. Enable publishing for one test repository.

## Smoke Checks

- Vercel dashboard loads.
- InsForge sign-in works on Vercel.
- Unauthenticated dashboard access redirects to `/sign-in`.
- InsForge account controls work.
- Vercel dashboard can call Coolify API.
- Dashboard API requests include `Authorization: Bearer <InsForge access token>`.
- Direct Coolify dashboard API calls without an InsForge token return `401`.
- Spoofed user/workspace headers cannot impersonate another user.
- Cross-workspace resource requests are denied.
- Admin and Developer role gates match `docs/AUTHORIZATION.md`.
- GitHub OAuth start/callback require a signed-in InsForge user.
- Billing management requires Admin or a verified billing capability.
- API health/readiness checks pass.
- Worker is connected to Redis.
- API and worker can reach NeonDB.
- GitHub webhook signature verification passes.
- Synthetic dry-run review completes.
