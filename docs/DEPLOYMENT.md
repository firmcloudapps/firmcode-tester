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
└── Billing
```

## Why Hybrid

- Vercel is the best deployment target for the Next.js dashboard, preview deployments, edge caching, Clerk frontend integration, and fast UI iteration.
- Coolify Docker is the right target for API and worker services that need long-running processes, queues, Semgrep, Tree-sitter dependencies, GitHub webhooks, and predictable container runtime behavior.
- NeonDB keeps PostgreSQL managed.
- Clerk keeps auth and billing managed.

## Request Flow

```text
User Browser
  -> Vercel Next.js Dashboard
  -> Coolify NestJS API
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
- Enable Clerk Billing and expose its subscription portal entry point through `CLERK_BILLING_PORTAL_URL`.
- Provide `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to the web app and `CLERK_SECRET_KEY` to server runtimes that validate sessions or call Clerk server APIs.

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
| API URL | `https://api.firmcode.example.com` | Vercel web, GitHub webhooks |
| GitHub webhook URL | `https://api.firmcode.example.com/webhooks/github` | GitHub App |
| Clerk callback URLs | Vercel production and preview URLs | Clerk |

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
4. Deploy API to Coolify.
5. Run migrations.
6. Deploy worker to Coolify.
7. Deploy web to Vercel.
8. Configure Clerk redirect URLs and allowed origins.
9. Configure GitHub App webhook URL.
10. Run dry-run fixture.
11. Enable publishing for one test repository.

## Smoke Checks

- Vercel dashboard loads.
- Clerk sign-in works on Vercel.
- Vercel dashboard can call Coolify API.
- API health/readiness checks pass.
- Worker is connected to Redis.
- API and worker can reach NeonDB.
- GitHub webhook signature verification passes.
- Synthetic dry-run review completes.
