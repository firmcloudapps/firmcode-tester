# Release Checklist

Use this checklist before deploying or enabling real GitHub publishing.

## Configuration

- Coolify API/worker service environment variables match `.env.example` and `docs/ENVIRONMENT.md`.
- Vercel project environment variables match `.env.example` and `docs/ENVIRONMENT.md`.
- `NEXT_PUBLIC_API_URL` points from Vercel web to the Coolify API.
- `CORS_ALLOWED_ORIGINS` includes Vercel production, preview origins if used, and local development.
- `DATABASE_URL` points to NeonDB or intended PostgreSQL.
- Database SSL is configured for NeonDB.
- Redis URL is configured.
- Clerk publishable and secret keys are configured.
- Clerk webhook secret is configured if syncing users/orgs.
- GitHub App ID, private key, and webhook secret are configured.
- LLM provider, API key, and model names are configured.
- Dry-run mode is intentionally set.
- Artifact retention is configured.

## Database

- Migrations run successfully.
- Required indexes exist.
- Backup/restore plan exists for non-local environments.
- Connection pool size is appropriate for NeonDB.

## Docker, Vercel, And Coolify

- API Docker image builds locally.
- Worker Docker image builds locally.
- `docker compose up --build` starts API, worker, and Redis with NeonDB configured through `DATABASE_URL`.
- API health/readiness checks pass in Docker.
- Worker starts and connects to Redis/database in Docker.
- Worker image includes Semgrep CLI.
- Worker image includes required Tree-sitter dependencies.
- Local Next.js dev and Vercel build for `apps/web` succeed.
- Vercel preview deployment can call the API if preview origins are enabled.
- Coolify API and worker build context and Dockerfile paths are documented.
- Coolify API and worker service ports and health checks are configured.
- Coolify API and worker environment variables are configured.
- Deployment order and migration command are documented.

## GitHub App

- Required permissions are granted.
- Webhook events are selected.
- Webhook delivery succeeds.
- Signature verification passes.
- Installation allowlist is configured for personal MVP if needed.
- FirmcodeAI scanning activity comment is created or updated on pull request events.

## Auth And Billing

- `@clerk/nextjs` is installed and the dashboard uses a real `ClerkProvider`.
- `/sign-in` and `/sign-up` routes work.
- Next.js middleware protects every dashboard page and dashboard API route handler.
- Unauthenticated dashboard access redirects to Clerk sign-in.
- Clerk sign-in works on local, Vercel preview if enabled, and production.
- Clerk user menu works.
- Clerk organization/workspace switcher works where enabled.
- Workspace/org mapping works.
- First login creates or resolves the expected personal/organization workspace.
- API dashboard routes verify Clerk bearer tokens server-side.
- Direct API calls without a token return `401`.
- Expired/invalid Clerk tokens return `401`.
- Spoofed user/workspace headers cannot impersonate another user.
- Production and normal local paths do not use `FIRMCODE_DASHBOARD_*`; only `FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN` is present in isolated web tests.
- Dashboard list endpoints return only the resolved workspace's repositories, pull requests, review runs, findings, CI failures, codebase scans, and settings data.
- Admin/Developer role gates match `docs/AUTHORIZATION.md`.
- Cross-workspace repository, review run, finding, artifact, settings, billing, GitHub OAuth, and policy access is denied.
- Billing portal link works.
- Billing management is limited to Admin or verified Clerk Billing capability.
- Unauthorized users cannot access dashboard data.
- Vercel dashboard can call Coolify API with Clerk-authenticated requests.
- GitHub OAuth connect flow requires a signed-in Clerk user.
- GitHub App install/sync management requires GitHub OAuth plus active Admin or Developer membership and plan allowance.

## Review Pipeline

- Synthetic dry-run fixture passes.
- Real test repository dry run passes.
- Semgrep scan artifacts are stored.
- Tree-sitter parse artifacts are stored.
- LLM output validates against schema.
- Inline comments map only to changed lines.
- Superseded run does not publish.

## Dashboard

- Overview loads.
- Repositories page loads.
- Review run detail loads.
- Findings page loads.
- Settings page loads.
- Billing page loads.
- Loading, empty, and error states render.
- Desktop and mobile layouts are visually checked.

## Security

- No secrets in logs.
- Webhook endpoint is rate-limited.
- Raw artifacts require authorization.
- Repository ownership checks pass.
- Data retention cleanup is scheduled or documented.

## Publishing

- Start in dry-run mode.
- Enable publishing for one test repository.
- Confirm summary comment update behavior.
- Confirm inline comment behavior.
- Confirm failure fallback behavior.
- Monitor GitHub rate limits and queue backlog.
