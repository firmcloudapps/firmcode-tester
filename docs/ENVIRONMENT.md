# Environment Configuration

Firmcode should use typed configuration validation in every runtime. Missing required variables must fail fast outside tests.

## Common

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | yes | `development`, `test`, or `production`. |
| `APP_URL` | yes | Public web app URL. The API uses this to build the GitHub OAuth callback URL. |
| `API_URL` | yes | Public API URL for webhooks and dashboard calls. |
| `NEXT_PUBLIC_API_URL` | web | Public API URL used by the Vercel dashboard. |
| `FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN` | tests only | Explicit web unit-test fixture token used to avoid live Clerk calls. This must not be set in production. |
| `FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID` | tests only | Optional workspace selector fixture sent only with a Clerk/test bearer token outside production. This must not be used as caller identity. |
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
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | web | Clerk sign-in route. Use `/sign-in` locally and in production unless Clerk hosted pages require a different URL. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | web | Clerk sign-up route. Use `/sign-up` locally and in production unless Clerk hosted pages require a different URL. |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | web | Post sign-in dashboard destination. Default `/`. |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | web | Post sign-up onboarding/dashboard destination. Default `/`. |
| `CLERK_JWT_AUDIENCE` | api/web server | Audience/template used for Clerk session tokens sent from Vercel web to the Coolify API. Required for production API token verification. |
| `CLERK_ISSUER` | api | Optional expected Clerk issuer when not inferred by the Clerk backend SDK. |

Clerk owns SaaS sign-in, sign-up, sessions, user profile, organizations/workspaces where enabled, member lifecycle where enabled, and Billing. Firmcode should validate Clerk session tokens in the API, map Clerk user/org IDs to internal workspaces, cache only the plan/capability/usage metadata needed for app authorization and display, and route subscription management to Clerk Billing instead of storing payment state locally.

The production dashboard authentication flow is:

1. Next.js middleware requires a Clerk session before rendering dashboard pages or dashboard route handlers.
2. Web server code reads Clerk auth state with `auth()` and obtains a Clerk session token for `CLERK_JWT_AUDIENCE`.
3. Web-to-API calls send `Authorization: Bearer <Clerk session token>`.
4. The NestJS API verifies the token with Clerk, derives the Clerk user and organization claims, resolves the Firmcode workspace/membership, and then applies role/capability checks.
5. The API must ignore client-provided user identity headers. Web tests may use `FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN` as an isolated bearer-token fixture, but production and normal local development must use Clerk sessions. Any legacy workspace/user shortcut is gated to `NODE_ENV=test` for direct controller tests only; setting `FIRMCODE_DASHBOARD_*` or sending `x-firmcode-user-id` is not a supported runtime authentication path.

Required Clerk dashboard configuration:

- Allowed application URLs:
  - local dashboard, for example `http://localhost:3000`
  - Vercel production dashboard URL
  - Vercel preview URLs if previews are enabled
- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-in URL: `/`
- After sign-up URL: `/`
- Organization settings enabled if team workspaces are supported in the environment.
- Clerk webhook endpoint configured only after the API endpoint exists and `CLERK_WEBHOOK_SECRET` is set.
- Optional trusted JWT role metadata for organization memberships can be exposed as `firmcode_role`, `org_firmcode_role`, `firmcode.role`, `organization_metadata.firmcode_role`, `public_metadata.firmcode_role`, or `metadata.firmcode_role`. Firmcode maps `admin`/legacy `owner` to Admin and `developer`/`member` to Developer; if absent, Clerk org admin/owner maps to Admin and org member maps to Developer.

Clerk webhook sync boundary: the API currently repairs the active workspace and membership at request time. A future Clerk webhook endpoint should consume user, organization, and organization-membership lifecycle events, set removed memberships inactive, and record elevated role changes in `workspace_audit_events`. Until that endpoint is deployed, support/admin sync must mark deleted or removed memberships inactive; request-time repair will not reactivate inactive memberships.

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

Repository-level dashboard configuration is persisted in PostgreSQL separately from environment defaults. Developers and Admins can fetch and update repository automation and review policy fields through the dashboard API; updates are workspace-scoped, preserve unspecified fields, and record update timestamps plus the Clerk user ID that made the change.

Workspace and repository Rules / Policies settings are also persisted in PostgreSQL through `GET /api/rules` and `PATCH /api/rules`. These policies cover review preferences, comment limits and severity thresholds, category enablement, prompt instructions, ignored paths, generated-file patterns, Semgrep settings, Tree-sitter/LLM/CI toggles, and infrastructure/security toggles. Repository-level policy mutations are available to Developers and Admins; global workspace/billing/retention policy mutations require Admin. Prompt instructions that look like secrets or tokens are rejected rather than stored.

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

The API validates `NODE_ENV`, `DATABASE_URL`, `DATABASE_SSL`, `CLERK_SECRET_KEY`, `CLERK_JWT_AUDIENCE`, and GitHub App credentials during startup. GitHub private keys may be raw PEM, escaped-newline PEM, or base64-encoded PEM. The web package validates Clerk publishable key, sign-in/sign-up URLs, after-auth redirects, API URL, and billing portal configuration. The dashboard provider boundary must use `ClerkProvider` from `@clerk/nextjs`; a no-op provider is acceptable only before Task 9.0 is started and must not satisfy release criteria.

## Deployment Targets

- Local and Vercel web need `NEXT_PUBLIC_API_URL`, Clerk publishable key, and any public dashboard config.
- Coolify API needs `DATABASE_URL`, `REDIS_URL`, Clerk secret, GitHub App credentials, CORS origins, and webhook secret.
- Coolify worker needs `DATABASE_URL`, `REDIS_URL`, LLM credentials, Semgrep settings, Tree-sitter settings, and GitHub App credentials if publishing from worker.
