# Local Development

Firmcode should be developed Docker-first for API and worker runtime behavior. Docker Compose is the canonical local integration path for the API, worker, and Redis because the API and worker will run as Docker containers on Coolify, while the web dashboard runs independently with Next.js dev locally and deploys to Vercel. Host-native commands can exist for fast inner-loop work, but every API or worker feature should be validated in the local Compose path before it is considered done.

## Prerequisites

- Node.js
- Python
- Docker Desktop or compatible Docker runtime
- GitHub account
- InsForge development project
- NeonDB development database
- Redis through Docker Compose
- LLM provider API key
- Optional webhook tunnel such as ngrok

## Setup Steps

1. Copy `.env.example` to `.env`.
2. Create an InsForge project and fill InsForge env vars.
3. Configure InsForge allowed redirect URLs for the local dashboard.
4. Create a NeonDB database and set `DATABASE_URL`.
5. Create GitHub App with required permissions and webhook secret.
6. Set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET`.
7. Set LLM provider/model variables.
8. Start API, worker, and Redis with local Docker Compose.
9. Run migrations.
10. Start the web dashboard independently with Next.js dev.
11. Sign in through InsForge, confirm workspace creation/mapping, then connect GitHub OAuth.
12. Use webhook tunnel for GitHub App webhook URL.

## InsForge Local Authentication Setup

Create an InsForge development project and configure:

- InsForge backend URL and anon key.
- Sign-in URL: `http://localhost:3000/sign-in`
- Sign-up URL: `http://localhost:3000/sign-up`
- After sign-in URL: `http://localhost:3000/auth/redirect`
- After sign-up URL: `http://localhost:3000/auth/redirect`
- Allowed redirect origin: `http://localhost:3000`
- Google OAuth configured in InsForge if you want to use the Google button locally.

Local `.env` values should include:

```text
AUTH_PROVIDER=insforge
NEXT_PUBLIC_AUTH_PROVIDER=insforge
INSFORGE_BASE_URL=https://h35yzuga.eu-central.insforge.app
NEXT_PUBLIC_INSFORGE_BASE_URL=https://h35yzuga.eu-central.insforge.app
NEXT_PUBLIC_INSFORGE_URL=https://h35yzuga.eu-central.insforge.app
INSFORGE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_INSFORGE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_INSFORGE_AFTER_SIGN_IN_URL=/auth/redirect
NEXT_PUBLIC_INSFORGE_AFTER_SIGN_UP_URL=/auth/redirect
FIRMCODE_DEFAULT_WORKSPACE_ID=
FIRMCODE_DEFAULT_WORKSPACE_NAME=Firmcode AI
```

The expected local auth flow is:

1. Visit `http://localhost:3000`.
2. The root holding page renders with dashboard entry points.
3. Sign in or sign up through InsForge.
4. Next.js stores the InsForge access token and httpOnly refresh token cookies, then sends the browser to `/auth/redirect`.
5. `/auth/redirect` calls the API with the InsForge bearer token, then the API creates or resolves the matching Firmcode profile and workspace membership.
6. `/auth/redirect` sends Admins to `/dashboard/admin` and Developers to `/dashboard/developer`.
7. Web server requests to the API include an InsForge bearer token.
8. API dashboard endpoints reject requests without a valid InsForge token.

Configured default or personal workspace signups resolve to Developer by default. For local Admin testing, update the database-backed `workspace_memberships.role` row after the user has signed in and `user_profiles`/membership rows have been created.
9. Connect GitHub OAuth from `/dashboard/developer` or `/github/installations` before using GitHub-backed workflows.

Do not use dashboard user or workspace environment shims for normal local development. Web-to-API calls should use InsForge sessions. `FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN`, its deprecated `FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN` alias, and `FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID` are reserved for isolated web unit tests only.

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

- Unauthenticated dashboard requests redirect to `/sign-in`.
- Signed-in dashboard requests include an InsForge bearer token when calling the API.
- API protected routes return `401` without a token and tenant-scoped data with a valid token.
- A user cannot access another workspace by changing request headers or IDs.
- `x-firmcode-user-id` and `FIRMCODE_DASHBOARD_*` do not authenticate any production or normal local request; only `FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN` and its deprecated `FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN` alias are allowed for isolated web unit tests.
- GitHub OAuth start/callback routes redirect to sign-in or return `401` unless an InsForge session token is present.
- Billing management is denied unless the resolved role is Admin or the token carries the billing capability.
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
- If InsForge auth fails in the web app, confirm `NEXT_PUBLIC_INSFORGE_BASE_URL`, `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, after-auth URLs, and allowed redirect URLs.
- If `/auth/redirect` sends a signed-in user back to `/sign-in`, confirm the web server runtime has `INSFORGE_BASE_URL` and `INSFORGE_ANON_KEY`, and confirm the browser has a fresh `insforge_access_token` cookie from the Next.js auth routes.
- If protected API calls return `401`, confirm the web route handler is sending `Authorization: Bearer <InsForge access token>` and the API is running with `AUTH_PROVIDER=insforge`.
- If protected API calls return `403`, confirm the InsForge user is mapped to an active workspace membership with the required role.
- If cross-workspace data appears, stop and fix workspace ownership checks before continuing; this is a release blocker.
- If NeonDB fails, confirm SSL settings and connection string.
- If worker does not process jobs, confirm `REDIS_URL` and queue names.
- If Semgrep is missing, confirm worker image includes Semgrep CLI.
- If something works on the host but fails in Docker, treat the Docker failure as the release blocker.
