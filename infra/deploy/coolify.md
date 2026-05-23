# Coolify API And Worker Deployment

Firmcode uses Coolify for long-running Docker services: the NestJS API in `apps/api`, the Python worker in `apps/worker`, and optionally Redis. Both API and worker use NeonDB through `DATABASE_URL`; do not add a PostgreSQL container for deployed or local Compose environments.

## Production Services

| Service | Coolify type | Image or build source | Exposed port | Health check |
| --- | --- | --- | --- | --- |
| Compose stack | Docker Compose | `docker-compose.prod.yml` | API `3001` only | service health checks |
| API | Compose service | `obehiaye/firmcode-api:latest` | `3001` | `GET /health` on port `3001` |
| Worker | Compose service | `obehiaye/firmcode-worker:latest` | none | `python -m firmcode_worker.runtime --check` |
| Redis | Compose internal Redis or external managed Redis | `redis:7-alpine` or provider-managed | internal only | Redis `PING` |
| NeonDB | external managed PostgreSQL | provider-managed | provider-managed | connection smoke from API and worker |

GitHub Actions builds and pushes the API and worker images to Docker Hub. Coolify should deploy the Compose stack by pulling those images, not by rebuilding the API or worker from source. Production Compose sets `pull_policy: always` for API and worker so a redeploy pulls the current `latest` image instead of reusing a stale local image.

Prefer deploying `docker-compose.prod.yml` in Coolify so API, worker, and Redis remain one production backend stack. The production Compose file intentionally excludes PostgreSQL and the Next.js web service.

## API Service

Coolify settings:

| Setting | Value |
| --- | --- |
| Image | `obehiaye/firmcode-api:latest` |
| Container port | `3001` |
| Public domain | `https://firmcodeapi.firmoncloud.com` |
| Health check path | `/health` |
| Readiness check | `/health/ready` when enabled |
| Start command | Dockerfile default: `npm run start --workspace @firmcode/api` |

Required API environment variables:

| Variable | Notes |
| --- | --- |
| `NODE_ENV=production` | Set explicitly for deployed API. |
| `PORT=3001` | Must match the exposed container port. |
| `APP_URL` | Vercel dashboard URL. |
| `API_URL` | Public Coolify API URL: `https://firmcodeapi.firmoncloud.com`. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated Vercel production, preview, and local dev origins. |
| `DATABASE_URL` | NeonDB PostgreSQL URL with database name and SSL mode. Example: `postgresql://user:password@host/dbname?sslmode=require`. |
| `DATABASE_SSL=true` | Required for NeonDB. |
| `REDIS_URL` | Coolify Redis internal URL or managed Redis URL. |
| `CLERK_SECRET_KEY` | Used to validate dashboard API requests. |
| `CLERK_WEBHOOK_SECRET` | Required if Clerk webhooks are enabled. |
| `GITHUB_APP_ID` | GitHub App ID. |
| `GITHUB_APP_PRIVATE_KEY` | PEM, escaped-newline, or base64 private key. In Coolify, prefer a single-line escaped-newline value such as `-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----` or a base64-encoded PEM. Do not log it. |
| `GITHUB_WEBHOOK_SECRET` | Used to verify GitHub webhook signatures. |
| `LOG_LEVEL` | Default `info`. |
| `DRY_RUN` | Start with `true` until smoke checks pass. |

API CORS must use explicit origins:

```text
CORS_ALLOWED_ORIGINS=https://firmcode.example.com,https://firmcode-git-main-owner.vercel.app,http://localhost:3000
```

Coolify Compose compatibility note: `docker-compose.prod.yml` uses `env_file: .env` for API and worker application settings. Coolify should generate this `.env` file from runtime-enabled environment variables for the Compose app.

The Compose `environment` blocks intentionally keep only fixed container-local values such as `NODE_ENV`, `PORT`, internal `REDIS_URL`, `DATABASE_SSL`, and `REVIEW_QUEUE_NAME`. Do not commit `.env`; keep secrets in Coolify environment variables and let Coolify write them to the Compose env file. If Coolify does not provide a variable, the API's safe runtime diagnostics will report the unresolved or missing shape without printing secret values.

If the API exits with `ConfigValidationError` for missing `DATABASE_URL`, `GITHUB_APP_ID`, or `GITHUB_APP_PRIVATE_KEY`, check these Coolify settings before changing application code:

- Deploy from `docker-compose.prod.yml`, not the standalone local compose file.
- If using a standalone Dockerfile resource instead of the Compose stack, attach the variables to that exact API resource; Compose `env_file` settings will not apply.
- Confirm each variable is enabled for runtime, not build-only.
- Redeploy or recreate the containers after editing variables; already-running containers will not pick up changed values.
- Keep `GITHUB_APP_PRIVATE_KEY` as a single-line escaped-newline PEM or base64-encoded PEM in Coolify.
- Use the Coolify terminal to check presence without printing secrets: `node -e 'for (const k of ["DATABASE_URL","GITHUB_APP_ID","GITHUB_APP_PRIVATE_KEY"]) console.log(k, process.env[k] ? "set" : "missing")'`.

## Worker Service

Coolify settings:

| Setting | Value |
| --- | --- |
| Image | `obehiaye/firmcode-worker:latest` |
| Container port | none |
| Public domain | none |
| Health check command | `python -m firmcode_worker.runtime --check` |
| Start command | Dockerfile default: `python -m firmcode_worker.runtime` |

Required worker environment variables:

| Variable | Notes |
| --- | --- |
| `NODE_ENV=production` | Keeps runtime behavior explicit across services. |
| `DATABASE_URL` | Same NeonDB database used by the API. |
| `DATABASE_SSL=true` | Required for NeonDB. |
| `REDIS_URL` | Same Redis used by the API. |
| `LOG_LEVEL` | Default `info`. |
| `DRY_RUN` | Start with `true`; disable only after dry-run verification. |
| `GITHUB_APP_ID` | Required if worker publishes GitHub comments. |
| `GITHUB_APP_PRIVATE_KEY` | Required if worker publishes GitHub comments. |
| `LLM_PROVIDER` | Initial LLM provider name. |
| `LLM_API_KEY` | Provider API key. |
| `LLM_REVIEW_MODEL` | Model for review reasoning. |
| `LLM_SUMMARY_MODEL` | Optional summary or CI explanation model. |
| `LLM_TIMEOUT_MS` | Optional provider timeout. |
| `LLM_MAX_RETRIES` | Optional retry count. |
| `SEMGREP_CONFIGS` | Default `auto,infra/semgrep`. |
| `SEMGREP_TIMEOUT_MS` | Optional Semgrep timeout. |
| `SEMGREP_STARTUP_VERSION_CHECK=false` | Deprecated compatibility setting. Worker startup does not run `semgrep --version`; it only verifies the executable exists. |
| `SEMGREP_STARTUP_TIMEOUT_SECONDS=30` | Deprecated compatibility setting retained for older deployed env files. |
| `SEMGREP_SEND_METRICS=off` | Disables Semgrep metrics reporting in worker containers. |
| `TREESITTER_TIMEOUT_MS` | Optional parse timeout. |
| `TREESITTER_MAX_FILE_BYTES` | Optional parse size limit. |

The worker image installs Semgrep CLI and Tree-sitter runtime dependencies. Treat a missing Semgrep binary or failed worker health check as a release blocker. Current worker startup logs include `semgrep_startup_probe="executable_only"`. If worker logs still show `{"name":"semgrep","status":"unavailable","error":"TimeoutExpired"}`, the deployed worker image is stale because current code has no startup path that executes Semgrep. Pull the latest `obehiaye/firmcode-worker:latest`, redeploy/recreate the worker container, and confirm new logs include `semgrep_startup_probe`.

## Redis Options

Use one of these shapes:

| Option | `REDIS_URL` shape | Notes |
| --- | --- | --- |
| Coolify Redis | `redis://<coolify-redis-host>:6379` | Simple for personal MVP deployments. Keep it private to the Coolify network. |
| Managed Redis | Provider URL, often `rediss://...` | Prefer for stronger backups, TLS, or managed operations. Ensure BullMQ supports the TLS settings. |

API and worker must point to the same Redis instance so webhook ingestion and review processing share one BullMQ queue.

Redis may log `WARNING Memory overcommit must be enabled` on Coolify hosts. That is a host kernel setting, not an application error. On the Coolify server, set `vm.overcommit_memory=1` persistently through `/etc/sysctl.conf` or `/etc/sysctl.d/*.conf`, then apply it with `sysctl vm.overcommit_memory=1` or reboot during a maintenance window.

## NeonDB

NeonDB is the only PostgreSQL deployment target for this scaffold. Set the same pooled NeonDB URL in API and worker:

```text
DATABASE_URL=postgresql://firmcode_owner:<password>@ep-example.us-east-2.aws.neon.tech/firmcode?sslmode=require
DATABASE_SSL=true
```

Use a production NeonDB branch for production and a separate branch or project for staging. Keep connection pooling sized for both API requests and worker concurrency.

## Migration Command

Run migrations from the API service after the API image deploys and before scaling workers:

```bash
npm run db:migrate:runtime --workspace @firmcode/api
```

The production API image already contains compiled JavaScript and omits TypeScript dev dependencies, so use the runtime migration command inside Coolify. From a source checkout during local development, `npm run db:migrate --workspace @firmcode/api` still builds the API package before applying migrations against `DATABASE_URL`.

## Deployment Order

1. Provision NeonDB and copy the pooled `DATABASE_URL`.
2. Provision Clerk and configure dashboard callback URLs.
3. Provision Redis through Coolify or a managed Redis provider.
4. Configure Docker Hub credentials and image-publish secrets in GitHub Actions.
5. Push to `main` and confirm the deploy workflow pushed `firmcode-api` and `firmcode-worker`.
6. Create the Coolify Compose application from `docker-compose.prod.yml`.
7. Configure production environment variables for the Compose app so Coolify writes them to `.env`.
8. Deploy API, worker, and Redis.
9. Run the migration command from the API service.
10. Keep one worker replica until live webhook processing is stable.
11. Deploy the Vercel dashboard with `NEXT_PUBLIC_API_URL` pointing to the API URL.
12. Add Vercel production and preview origins to API `CORS_ALLOWED_ORIGINS`.
13. Configure GitHub App webhook URL: `https://firmcodeapi.firmoncloud.com/webhooks/github`.
14. Run a synthetic dry-run review before setting `DRY_RUN=false`.

## Rollback Notes

Rollback in dependency order:

- If the API deploy fails health checks, roll back the API service to the previous Coolify deployment and keep workers on the previous compatible version.
- If the worker deploy fails, roll back only the worker first; the API can keep accepting webhooks if queued jobs remain compatible.
- If migrations have run, confirm whether the previous API and worker versions are backward compatible with the migrated schema before rolling back binaries.
- Keep `DRY_RUN=true` during rollback validation to avoid duplicate or malformed GitHub comments.
- Pause or scale workers to zero before investigating poison jobs or schema-incompatible jobs.

## Worker Scaling

Start with one worker replica. Scale horizontally only after confirming:

- Redis queue backlog is sustained.
- NeonDB connection pool has capacity for additional worker processes.
- LLM and GitHub rate limits can tolerate higher concurrency.
- Jobs are idempotent enough to survive retries and duplicate deliveries.

Scale workers in Coolify by increasing replicas for the worker service. Do not expose a public port for worker replicas. If queue errors rise, reduce replicas, inspect failed jobs, and leave API ingestion in dry-run or restricted mode until the queue is stable.

## Local Compose Mapping

The local Docker Compose stack mirrors Coolify service boundaries:

| Local Compose | Deployed Target | Notes |
| --- | --- | --- |
| `api` | Coolify API service | Same service boundary, local Dockerfile `api.Dockerfile`, production image `firmcode-api`, container port `3001`, and `/health` check. |
| `worker` | Coolify worker service | Same service boundary, local Dockerfile `worker.Dockerfile`, production image `firmcode-worker`, and runtime health command. |
| `redis` | Coolify Redis or managed Redis | Local URL is `redis://redis:6379`; deployed URL comes from provider. |
| Host-provided `DATABASE_URL` | NeonDB | Compose and Coolify both use external NeonDB; neither runs PostgreSQL. |
| Local web outside Compose | Vercel dashboard | Local web uses `NEXT_PUBLIC_API_URL=http://localhost:3001`; Vercel uses the public Coolify API URL. |

Before deploying API or worker changes, run the local Docker smoke path:

```bash
export DATABASE_URL="postgresql://firmcode_owner:<password>@ep-example.us-east-2.aws.neon.tech/firmcode?sslmode=require"
export DATABASE_SSL=true
bash infra/docker/smoke.sh
```

The smoke path verifies API and worker images, Redis health, API health endpoints, worker startup checks, Semgrep availability, Tree-sitter runtime availability, and NeonDB connectivity.
