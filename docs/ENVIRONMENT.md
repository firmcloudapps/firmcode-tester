# Environment Configuration

Firmcode should use typed configuration validation in every runtime. Missing required variables must fail fast outside tests.

## Common

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | yes | `development`, `test`, or `production`. |
| `APP_URL` | yes | Public web app URL. The API uses this to build the GitHub OAuth callback URL. |
| `API_URL` | yes | Public API URL for webhooks and dashboard calls. |
| `NEXT_PUBLIC_API_URL` | web | Public API URL used by the Vercel dashboard. |
| `FIRMCODE_DASHBOARD_WORKSPACE_ID` | web server, temporary | Internal workspace ID forwarded by dashboard mutation proxy routes until Clerk-backed API session validation replaces the local header shim. |
| `FIRMCODE_DASHBOARD_CLERK_USER_ID` | web server, temporary | Clerk user ID forwarded by dashboard mutation proxy routes until Clerk-backed API session validation replaces the local header shim. |
| `FIRMCODE_DASHBOARD_CLERK_BILLING_CAPABILITY` | web server, temporary | Optional Clerk Billing capability forwarded by dashboard API proxy routes; use `manage_billing` only for local/staging users Clerk has authorized for billing management. |
| `CORS_ALLOWED_ORIGINS` | api | Comma-separated Vercel production, Vercel preview, and local web origins. |
| `VERCEL_URL` | Vercel | Auto-provided Vercel deployment URL, useful for preview handling. |
| `LOG_LEVEL` | no | `debug`, `info`, `warn`, or `error`. Default `info`. |
| `DRY_RUN` | no | If `true`, analyze PRs but do not post GitHub comments. |

## Database And Queue

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | NeonDB/PostgreSQL connection string using the `postgres://` or `postgresql://` scheme and a database name. |
| `DATABASE_SSL` | api/worker | Enable SSL for NeonDB. Default to `true` locally and in production. |
| `REDIS_URL` | yes | Redis connection string for BullMQ. |
| `REVIEW_QUEUE_NAME` | worker | BullMQ review queue to consume. Defaults to `review-runs`. |

Local development uses NeonDB, not a local PostgreSQL container. NeonDB connection strings should keep the provider's SSL mode and set `DATABASE_SSL=true` in API and worker environments.

Run database migrations from the repository root with:

```bash
npm run db:migrate --workspace @firmcode/api
```

The command builds the API package and applies pending migrations against `DATABASE_URL`.

Inside the production API container, use the compiled runtime command instead:

```bash
npm run db:migrate:runtime --workspace @firmcode/api
```

Inside Docker Compose, API and worker receive the same external NeonDB URL from the host environment:

```text
DATABASE_URL=postgresql://firmcode_owner:<password>@ep-example.us-east-2.aws.neon.tech/firmcode?sslmode=require
DATABASE_SSL=true
REDIS_URL=redis://redis:6379
```

## Clerk

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | web | Clerk publishable key. |
| `CLERK_SECRET_KEY` | api/web server | Clerk secret key for server-side auth. |
| `CLERK_WEBHOOK_SECRET` | api | Clerk webhook signing secret if syncing users/orgs. |
| `CLERK_BILLING_PORTAL_URL` | web | Clerk-managed subscription portal or account billing entry point shown from the dashboard Billing page. |

Clerk owns SaaS sign-in, sign-up, sessions, user profile, organizations/workspaces where enabled, member lifecycle where enabled, and Billing. Firmcode should validate Clerk session tokens in the API, map Clerk user/org IDs to internal workspaces, cache only the plan/capability/usage metadata needed for app authorization and display, and route subscription management to Clerk Billing instead of storing payment state locally.

## GitHub App

| Variable | Required | Description |
| --- | --- | --- |
| `GITHUB_APP_ID` | yes | GitHub App ID. |
| `GITHUB_APP_PRIVATE_KEY` | yes | PEM private key, escaped-newline string, or base64-encoded PEM. |
| `GITHUB_WEBHOOK_SECRET` | yes | Secret used to verify `X-Hub-Signature-256`. |
| `GITHUB_CLIENT_ID` | yes | GitHub OAuth client ID. Required because every Firmcode user must connect GitHub OAuth. |
| `GITHUB_CLIENT_SECRET` | yes | GitHub OAuth client secret. Required because every Firmcode user must connect GitHub OAuth. |
| `GITHUB_ALLOWED_INSTALLATIONS` | no | Comma-separated installation IDs for temporary MVP allowlisting during controlled SaaS rollout. |
| `GITHUB_APP_INSTALL_URL` | web | Public GitHub App installation URL shown by `/github/installations`, for example `https://github.com/apps/<slug>/installations/new`. |
| `GITHUB_APP_SLUG` | web | GitHub App slug used to derive the install URL when `GITHUB_APP_INSTALL_URL` is not set. |

Configure the GitHub App OAuth callback URL to the dashboard callback route:

```text
https://firmcode.firmoncloud.com/api/auth/github/callback
```

Keep `APP_URL=https://firmcode.firmoncloud.com` on the API service and `NEXT_PUBLIC_API_URL=https://firmcodeapi.firmoncloud.com` on the web service so the dashboard callback can forward securely to the API token exchange endpoint.

## LLM

| Variable | Required | Description |
| --- | --- | --- |
| `LLM_PROVIDER` | yes | Initial provider name. |
| `LLM_API_KEY` | yes | Provider API key. |
| `LLM_REVIEW_MODEL` | yes | Model for final review reasoning. |
| `LLM_SUMMARY_MODEL` | no | Lower-cost model for summaries/CI explanation if supported. |
| `LLM_TIMEOUT_MS` | no | Request timeout. |
| `LLM_MAX_RETRIES` | no | Retry count for transient provider failures. |
| `LLM_MAX_INPUT_TOKENS` | no | Context budget for review prompts. |
| `LLM_MAX_OUTPUT_TOKENS` | no | Output budget. |

## Review Controls

| Variable | Required | Description |
| --- | --- | --- |
| `REVIEW_MAX_INLINE_COMMENTS` | no | Default max inline comments per PR. |
| `REVIEW_MIN_SEVERITY` | no | Minimum severity for inline comments. |
| `REVIEW_SKIP_DRAFT_PRS` | no | Skip draft PRs by default. |
| `REVIEW_LARGE_PR_MAX_CHANGED_FILES` | no | Changed-file count before prioritized large-PR mode. |
| `REVIEW_LARGE_PR_MAX_DIFF_BYTES` | no | Total diff bytes before prioritized large-PR mode. |
| `REVIEW_LARGE_PR_MAX_CHANGED_LINES` | no | Total added plus deleted lines before prioritized large-PR mode. |
| `REVIEW_LARGE_PR_MAX_ESTIMATED_TOKENS` | no | Estimated prompt tokens before prioritized large-PR mode. |
| `REVIEW_LARGE_PR_MAX_FILTERED_FILES` | no | Max files after generated/vendor filtering before prioritized mode. |
| `REVIEW_LARGE_PR_MAX_SEMGREP_RUNTIME_MS` | no | Semgrep runtime budget before prioritized mode. |
| `REVIEW_LARGE_PR_MAX_FULL_CONTEXT_FILES` | no | Max full-context files retained in prioritized mode before summarizing lower-priority files. |
| `REVIEW_SUMMARY_ONLY_DIFF_BYTES` | no | Diff-byte threshold for summary-only mode. |
| `REVIEW_SUMMARY_ONLY_CHANGED_LINES` | no | Changed-line threshold for summary-only mode. |
| `REVIEW_SUMMARY_ONLY_ESTIMATED_TOKENS` | no | Estimated-token threshold for summary-only mode. |
| `REVIEW_CI_LOG_MAX_BYTES` | no | Maximum redacted CI log bytes retained per failed check for storage and LLM context. Defaults to `20000`. |
| `ARTIFACT_RETENTION_DAYS` | no | Default artifact retention. |
| `CODEBASE_SCAN_DEFAULT_CADENCE_HOURS` | no | Default repeat cadence for enabled repository codebase scans. Defaults to `24`. |
| `CODEBASE_SCAN_QUEUE_NAME` | no | Worker queue name for repository codebase scan jobs. Defaults to `codebase-scans`. |
| `CODEBASE_SCAN_MAX_FILES` | no | Maximum supported files fetched and scanned from one repository default-branch tree. Defaults to `500`. |
| `CODEBASE_SCAN_MAX_TOTAL_BYTES` | no | Maximum total fetched file bytes for one codebase scan. Defaults to `10000000`. |
| `CODEBASE_SCAN_MAX_FILE_BYTES` | no | Maximum individual file size fetched for one codebase scan. Defaults to `500000`. |
| `CODEBASE_SCAN_IGNORED_PATHS` | no | Comma-separated repository-relative glob patterns skipped by codebase scans. |
| `CODEBASE_SCAN_REPOSITORY_ALLOWLIST` | no | Optional comma-separated `owner/repo` glob allowlist for codebase scans. Empty allows all enabled repositories. |
| `CODEBASE_SCAN_ARTIFACT_DIR` | no | Local directory for redacted codebase scan artifacts. Defaults to the system temp directory under `firmcode-codebase-scans`. |
| `CODEBASE_SCAN_ARTIFACT_RETENTION_DAYS` | no | Retention window stamped onto codebase scan artifact metadata. Defaults to `30`. |
| `CODEBASE_SCAN_LLM_ENABLED` | no | Enables optional LLM recommendations from redacted deterministic scan evidence. Defaults to `false`. |
| `CODEBASE_SCAN_LLM_MODEL` | no | Model name for optional codebase scan LLM recommendations. Defaults to `LLM_REVIEW_MODEL` when set. |

Repository-level dashboard configuration is persisted in PostgreSQL separately from environment defaults. Owners/Admins can fetch and update repository automation and review policy fields through the dashboard API; updates are workspace-scoped, preserve unspecified fields, and record update timestamps plus the Clerk user ID that made the change.

Workspace and repository Rules / Policies settings are also persisted in PostgreSQL through `GET /api/rules` and `PATCH /api/rules`. These policies cover review preferences, comment limits and severity thresholds, category enablement, prompt instructions, ignored paths, generated-file patterns, Semgrep settings, Tree-sitter/LLM/CI toggles, and infrastructure/security toggles. Policy mutations require Owner/Admin membership; prompt instructions that look like secrets or tokens are rejected rather than stored.

## Semgrep

| Variable | Required | Description |
| --- | --- | --- |
| `SEMGREP_TIMEOUT_MS` | no | Semgrep process timeout. |
| `SEMGREP_CONFIGS` | no | Comma-separated configs. Default uses `infra/semgrep/config.yml`. `auto`, `infra/semgrep`, and `infra/semgrep/` are treated as the local config file so production never scans rule-test fixtures as configs. |
| `SEMGREP_MAX_TARGET_BYTES` | no | Per-file scan size limit. |
| `SEMGREP_SCAN_TEMP_DIR` | no | Base directory for isolated changed-file scan workspaces. Defaults to the system temp directory under `firmcode-semgrep`. |
| `SEMGREP_STARTUP_TIMEOUT_SECONDS` | no | Deprecated compatibility setting. Worker startup no longer executes `semgrep --version`; full Semgrep execution happens during scan jobs. |
| `SEMGREP_STARTUP_VERSION_CHECK` | no | Deprecated compatibility setting. Startup always verifies only that the Semgrep executable is present. |
| `SEMGREP_SEND_METRICS` | no | Set to `off` in Docker images and production Compose so Semgrep startup and scans do not attempt metrics reporting. |

## Tree-sitter

| Variable | Required | Description |
| --- | --- | --- |
| `TREESITTER_TIMEOUT_MS` | no | Per-file parse timeout. |
| `TREESITTER_MAX_FILE_BYTES` | no | Max file size for parsing. |

## Example Files

Implementation should add:

- `.env.example`
- `apps/api/.env.example`
- `apps/web/.env.example`
- `apps/worker/.env.example`

No secrets should be committed.

The API validates `NODE_ENV`, `DATABASE_URL`, `DATABASE_SSL`, `CLERK_SECRET_KEY`, and GitHub App credentials during startup. GitHub private keys may be raw PEM, escaped-newline PEM, or base64-encoded PEM. The web package has Clerk config validation for `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_BILLING_PORTAL_URL`; the current provider boundary is ready to be replaced with `ClerkProvider` from `@clerk/nextjs` once the dependency is added.

## Deployment Targets

- Local and Vercel web need `NEXT_PUBLIC_API_URL`, Clerk publishable key, and any public dashboard config.
- Coolify API needs `DATABASE_URL`, `REDIS_URL`, Clerk secret, GitHub App credentials, CORS origins, and webhook secret.
- Coolify worker needs `DATABASE_URL`, `REDIS_URL`, LLM credentials, Semgrep settings, Tree-sitter settings, and GitHub App credentials if publishing from worker.
