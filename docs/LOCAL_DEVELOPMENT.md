# Local Development

Firmcode should be developed Docker-first for API and worker runtime behavior. Docker Compose is the canonical local integration path for the API, worker, and Redis because the API and worker will run as Docker containers on Coolify, while the web dashboard runs independently with Next.js dev locally and deploys to Vercel. Host-native commands can exist for fast inner-loop work, but every API or worker feature should be validated in the local Compose path before it is considered done.

## Prerequisites

- Node.js
- Python
- Docker Desktop or compatible Docker runtime
- GitHub account
- Clerk development application
- NeonDB development database
- Redis through Docker Compose
- LLM provider API key
- Optional webhook tunnel such as ngrok

## Setup Steps

1. Copy `.env.example` to `.env`.
2. Create Clerk application and fill Clerk env vars.
3. Configure Clerk sign-in/sign-up URLs and organization settings.
4. Create a NeonDB database and set `DATABASE_URL`.
5. Create GitHub App with required permissions and webhook secret.
6. Set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET`.
7. Set LLM provider/model variables.
8. Start API, worker, and Redis with local Docker Compose.
9. Run migrations.
10. Start the web dashboard independently with Next.js dev.
11. Sign in through Clerk, confirm workspace creation/mapping, then connect GitHub OAuth.
12. Use webhook tunnel for GitHub App webhook URL.

## Clerk Local Authentication Setup

Create a Clerk development application and configure:

- Sign-in URL: `http://localhost:3000/sign-in`
- Sign-up URL: `http://localhost:3000/sign-up`
- After sign-in URL: `http://localhost:3000/`
- After sign-up URL: `http://localhost:3000/`
- Allowed redirect origin: `http://localhost:3000`
- Organizations enabled if testing team workspaces.
- A JWT template or audience matching `CLERK_JWT_AUDIENCE` for API calls.

Local `.env` values should include:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_AUDIENCE=firmcode-api
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

The expected local auth flow is:

1. Visit `http://localhost:3000`.
2. Unauthenticated users are redirected to `/sign-in`.
3. Sign in or sign up through Clerk.
4. The dashboard creates or resolves the active personal or organization workspace.
5. Web server requests to the API include a Clerk bearer token.
6. API dashboard endpoints reject requests without a valid Clerk token.
7. Connect GitHub OAuth from `/github/installations` before using GitHub-backed workflows.

Do not use `FIRMCODE_DASHBOARD_WORKSPACE_ID` or `FIRMCODE_DASHBOARD_CLERK_USER_ID` for normal local development once Task 9.0 is implemented. Those variables are reserved for isolated tests and explicit seed/debug bypass workflows.

## Docker-First Workflow

Default local workflow:

```bash
docker compose up --build
```

Production/Coolify Compose is separate:

```bash
docker compose -f docker-compose.prod.yml config --quiet
```

Task 0.2 smoke workflow:

```bash
bash infra/docker/smoke.sh
```

The Compose stack should include:

- `api`
- `worker`
- `redis`

The API and worker containers should use the same production entrypoints planned for Coolify wherever practical. The web dashboard runs independently with `npm run dev --workspace @firmcode/web` for local development and deploys to Vercel in production.

Do not add PostgreSQL or the Next.js web app to either backend Compose stack. NeonDB and Vercel own those roles.

Before merging implementation work, verify:

- Unauthenticated dashboard requests redirect to Clerk sign-in.
- Signed-in dashboard requests include a Clerk bearer token when calling the API.
- API protected routes return `401` without a token and tenant-scoped data with a valid token.
- A user cannot access another workspace by changing request headers or IDs.
- API image builds.
- Worker image builds.
- Worker image includes Semgrep CLI and Tree-sitter runtime dependencies.
- API can reach Redis and NeonDB from inside the container network.
- Worker can reach Redis and NeonDB from inside the container network.
- Local Next.js dev can reach the API through `NEXT_PUBLIC_API_URL`.
- API CORS accepts local web origin and planned Vercel origins.
- Health/readiness checks pass inside containers.

Compose uses the host-provided NeonDB `DATABASE_URL` and `REDIS_URL=redis://redis:6379` inside API and worker containers. The web dashboard uses `NEXT_PUBLIC_API_URL=http://localhost:3001` when run locally.

If a host port is already occupied, override only the host binding while leaving container DNS and ports unchanged:

```bash
API_PORT=3301 docker compose up --build api
REDIS_PORT=56379 docker compose up redis
```

Run the web dashboard locally outside Docker:

```bash
npm run dev --workspace @firmcode/web
```

## Hybrid Deployment Shape

Production deployment should be split:

- Vercel deploys the Next.js dashboard.
- Coolify deploys the API service.
- Coolify deploys the worker service.
- Redis runs on Coolify or a managed Redis provider.
- NeonDB is external managed PostgreSQL for local development and production-like deployments.

Deployment documentation should live in `infra/deploy/vercel.md` and `infra/deploy/coolify.md` once the scaffold exists. It should include:

- service definitions
- build context and Dockerfile paths
- exposed ports
- health checks
- environment variables
- persistent volumes if any
- deployment order
- migration strategy
- worker scaling notes
- Vercel production and preview environment variables
- API CORS allowed origins

## GitHub App Local Webhook URL

Use:

```text
https://<tunnel-host>/webhooks/github
```

Redeliver events from GitHub App settings while testing.

## Dry Run First

Set:

```text
DRY_RUN=true
```

Confirm review output in dashboard before enabling GitHub publishing.

## Seed Data

Implementation should provide a seed command for:

- workspace
- repository
- pull request
- review run
- findings
- artifacts

This enables dashboard development without live GitHub webhooks.

## Fixture Review

Implementation should provide one command to run the synthetic dry-run review fixture described in `docs/TASKS.md`.

Expected output:

- review run record
- changed files
- Semgrep artifact
- Tree-sitter artifact
- LLM output artifact
- findings
- would-be GitHub comments

## Common Commands

Expected commands after scaffold:

```bash
npm install
npm run dev
npm run test
npm run lint
npm run build
pytest apps/worker/tests
docker compose up -d
DATABASE_URL="postgresql://..." docker compose up --build
docker compose run --rm api npm run test
docker compose run --rm worker pytest
```

## Troubleshooting

- If webhook verification fails, confirm raw body handling and `GITHUB_WEBHOOK_SECRET`.
- If Clerk auth fails in the web app, confirm publishable key, sign-in/sign-up URLs, after-auth URLs, allowed redirect URLs, and middleware route matching.
- If protected API calls return `401`, confirm the web route handler is sending `Authorization: Bearer <Clerk token>`, `CLERK_SECRET_KEY` is configured on the API, and `CLERK_JWT_AUDIENCE` matches the token template/audience.
- If protected API calls return `403`, confirm the Clerk user is mapped to an active workspace membership with the required role.
- If cross-workspace data appears, stop and fix workspace ownership checks before continuing; this is a release blocker.
- If NeonDB fails, confirm SSL settings and connection string.
- If worker does not process jobs, confirm `REDIS_URL` and queue names.
- If Semgrep is missing, confirm worker image includes Semgrep CLI.
- If something works on the host but fails in Docker, treat the Docker failure as the release blocker.
