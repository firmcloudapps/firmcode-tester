# Local Development

Firmcode should be developed Docker-first. Docker Compose is the canonical local integration path because the API and worker will run as Docker containers on Coolify, while the web dashboard will deploy to Vercel. Host-native commands can exist for fast inner-loop work, but every feature should be validated in the local full-stack Compose path before it is considered done.

## Prerequisites

- Node.js
- Python
- Docker Desktop or compatible Docker runtime
- GitHub account
- Clerk development application
- NeonDB development database or local PostgreSQL
- Redis through Docker Compose
- LLM provider API key
- Optional webhook tunnel such as ngrok

## Setup Steps

1. Copy `.env.example` to `.env`.
2. Create Clerk application and fill Clerk env vars.
3. Create NeonDB database or use local Compose PostgreSQL and set `DATABASE_URL`.
4. Create GitHub App with required permissions and webhook secret.
5. Set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET`.
6. Set LLM provider/model variables.
7. Start services with Docker Compose.
8. Run migrations.
9. Start API, web, and worker.
10. Use webhook tunnel for GitHub App webhook URL.

## Docker-First Workflow

Default local workflow:

```bash
docker compose up --build
```

The Compose stack should include:

- `api`
- `web`
- `worker`
- `postgres` for local development when not using NeonDB
- `redis`

The API and worker containers should use the same production entrypoints planned for Coolify wherever practical. The web container exists for local integration and fallback deployment confidence; production web deploys to Vercel. Development-only bind mounts and hot reload are acceptable, but the project must also support clean image builds without relying on host-installed dependencies.

Before merging implementation work, verify:

- API image builds.
- Web image builds.
- Worker image builds.
- Worker image includes Semgrep CLI and Tree-sitter runtime dependencies.
- API can reach Redis and the configured database from inside the container network.
- Worker can reach Redis and the configured database from inside the container network.
- Web can reach the API through configured environment variables.
- API CORS accepts local web origin and planned Vercel origins.
- Health/readiness checks pass inside containers.

## Hybrid Deployment Shape

Production deployment should be split:

- Vercel deploys the Next.js dashboard.
- Coolify deploys the API service.
- Coolify deploys the worker service.
- Redis runs on Coolify or a managed Redis provider.
- NeonDB is external managed PostgreSQL.

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
docker compose up --build
docker compose run --rm api npm run test
docker compose run --rm worker pytest
```

## Troubleshooting

- If webhook verification fails, confirm raw body handling and `GITHUB_WEBHOOK_SECRET`.
- If Clerk auth fails, confirm publishable/secret keys and allowed redirect URLs.
- If NeonDB fails, confirm SSL settings and connection string.
- If worker does not process jobs, confirm `REDIS_URL` and queue names.
- If Semgrep is missing, confirm worker image includes Semgrep CLI.
- If something works on the host but fails in Docker, treat the Docker failure as the release blocker.
