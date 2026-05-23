# Environment Configuration

Firmcode should use typed configuration validation in every runtime. Missing required variables must fail fast outside tests.

## Common

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | yes | `development`, `test`, or `production`. |
| `APP_URL` | yes | Public web app URL. |
| `API_URL` | yes | Public API URL for webhooks and dashboard calls. |
| `NEXT_PUBLIC_API_URL` | web | Public API URL used by the Vercel dashboard. |
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
npm run db:migrate
```

The command builds the API package and applies pending migrations against `DATABASE_URL`.

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

Clerk owns sign-in, sign-up, sessions, user profile, organizations where enabled, and Billing. Firmcode should validate Clerk session tokens in the API, map Clerk user/org IDs to internal workspaces, and route subscription management to Clerk Billing instead of storing payment state locally.

## GitHub App

| Variable | Required | Description |
| --- | --- | --- |
| `GITHUB_APP_ID` | yes | GitHub App ID. |
| `GITHUB_APP_PRIVATE_KEY` | yes | PEM private key, escaped-newline string, or base64-encoded PEM. |
| `GITHUB_WEBHOOK_SECRET` | yes | Secret used to verify `X-Hub-Signature-256`. |
| `GITHUB_CLIENT_ID` | oauth | GitHub OAuth client ID if OAuth is enabled. |
| `GITHUB_CLIENT_SECRET` | oauth | GitHub OAuth client secret if OAuth is enabled. |
| `GITHUB_ALLOWED_INSTALLATIONS` | no | Comma-separated installation IDs for personal MVP allowlist. |

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
| `ARTIFACT_RETENTION_DAYS` | no | Default artifact retention. |

## Semgrep

| Variable | Required | Description |
| --- | --- | --- |
| `SEMGREP_TIMEOUT_MS` | no | Semgrep process timeout. |
| `SEMGREP_CONFIGS` | no | Comma-separated configs. Default includes `auto` and local infra rules. |
| `SEMGREP_MAX_TARGET_BYTES` | no | Per-file scan size limit. |
| `SEMGREP_SCAN_TEMP_DIR` | no | Base directory for isolated changed-file scan workspaces. Defaults to the system temp directory under `firmcode-semgrep`. |
| `SEMGREP_STARTUP_TIMEOUT_SECONDS` | no | Worker startup timeout for `semgrep --version`. Defaults to `20`; Docker images set `30` to allow first-start CLI warmup. |
| `SEMGREP_STARTUP_VERSION_CHECK` | no | Whether worker startup should execute `semgrep --version`. Defaults to `false`; startup normally verifies the executable exists and leaves full CLI execution to scan jobs. |

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
