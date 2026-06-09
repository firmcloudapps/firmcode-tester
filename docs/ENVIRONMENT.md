# Environment Configuration

Firmcode should use typed configuration validation in every runtime. Missing required variables must fail fast outside tests.

## Common

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | yes | `development`, `test`, or `production`. |
| `APP_URL` | yes | Public web app URL. The API uses this to build the GitHub OAuth callback URL. |
| `API_URL` | yes | Public API URL for webhooks and server-side dashboard calls. The Vercel web app uses this before `NEXT_PUBLIC_API_URL` when fetching Nest API data. |
| `NEXT_PUBLIC_API_URL` | web | Public API URL fallback for the Vercel dashboard and local simple setups. Keep it pointed at the API, not the web frontend. |
| `FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN` | tests only | Explicit web unit-test fixture bearer token used to avoid live InsForge calls. This must not be set in production. |
| `FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN` | tests only | Deprecated alias for `FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN`, retained only for old isolated tests. |
| `FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID` | tests only | Optional workspace selector fixture sent only with a test bearer token outside production. This must not be used as caller identity. |
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

## InsForge Auth

| Variable | Required | Description |
| --- | --- | --- |
| `AUTH_PROVIDER` | api/web | Must be `insforge`. |
| `NEXT_PUBLIC_AUTH_PROVIDER` | web | Must be `insforge` for client-rendered auth surfaces. |
| `INSFORGE_BASE_URL` | api/web server | InsForge backend URL used by server-side session checks. |
| `INSFORGE_ANON_KEY` | api/web server | InsForge anon key used by server-side SDK clients. |
| `NEXT_PUBLIC_INSFORGE_BASE_URL` | web | Public InsForge backend URL used by the browser SDK. |
| `NEXT_PUBLIC_INSFORGE_URL` | web | Official SDK alias for the public InsForge backend URL. Keep it equal to `NEXT_PUBLIC_INSFORGE_BASE_URL`. |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | web | Public InsForge anon key used by the browser SDK. |
| `INSFORGE_SERVICE_KEY` | api | Service key for server-owned InsForge operations, if enabled. Never expose this as `NEXT_PUBLIC_*`. |
| `NEXT_PUBLIC_INSFORGE_SIGN_IN_URL` | web | Optional sign-in route override. Defaults to `/sign-in`. |
| `NEXT_PUBLIC_INSFORGE_SIGN_UP_URL` | web | Optional sign-up route override. Defaults to `/sign-up`. |
| `NEXT_PUBLIC_INSFORGE_AFTER_SIGN_IN_URL` | web | Optional post-sign-in destination. Defaults to `/auth/redirect`. |
| `NEXT_PUBLIC_INSFORGE_AFTER_SIGN_UP_URL` | web | Optional post-sign-up destination. Defaults to `/auth/redirect`. |
| `FIRMCODE_DEFAULT_WORKSPACE_ID` | api | Optional default workspace ID for InsForge-authenticated users. Leave empty to create/resolve personal workspaces. |
| `FIRMCODE_DEFAULT_WORKSPACE_NAME` | api | Display name for the default workspace. Defaults to `Firmcode AI`. |

InsForge owns SaaS sign-in, sign-up, sessions, user profile, OAuth, and email verification. Firmcode validates InsForge JWTs in the API, maps InsForge user/org IDs to internal workspaces, and caches only the metadata needed for authorization and display.

The production dashboard authentication flow is:

1. The browser signs in with the InsForge SDK and receives an access token.
2. The web app stores the access token in the `insforge_access_token` cookie for Next.js route handlers and server components.
3. Web-to-API calls send `Authorization: Bearer <InsForge access token>`.
4. The NestJS API verifies the InsForge token, derives the user/org claims, resolves the Firmcode workspace/membership, and then applies role/capability checks.
5. After successful sign-in or sign-up, the browser goes to `/auth/redirect`, which calls `/api/settings` with the bearer token and routes Admins to `/dashboard/admin` and Developers to `/dashboard/developer`.
6. The API must ignore client-provided user identity headers. Web tests may use `FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN` as an isolated bearer-token fixture, but production and normal local development must use InsForge sessions. Any legacy workspace/user shortcut is gated to `NODE_ENV=test` for direct controller tests only; setting `FIRMCODE_DASHBOARD_*` or sending `x-firmcode-user-id` is not a supported runtime authentication path.

Required InsForge dashboard configuration:

- Allowed redirect URLs include local, production, and preview dashboard origins.
- Email/password authentication is enabled.
- Google OAuth is enabled if the dashboard should show the Google sign-in action.
- Link-based email verification redirect URLs include `/sign-in`.
- User profiles and workspace roles are stored in the Firmcode database. Token metadata may help seed a brand-new membership, but existing roles must be changed through the database-backed settings/support/admin path.

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

Firmcode supports two GitHub App install return flows.

If **Request user authorization (OAuth) during installation** is enabled, configure the first GitHub App callback URL to the dashboard OAuth callback route:

```text
https://firmcode.firmoncloud.com/api/auth/github/callback
```

GitHub redirects there with a `code` after installation. Firmcode completes OAuth for the signed-in InsForge user and discovers accessible app installations through the user access token.

If OAuth during installation is disabled, configure the GitHub App setup URL to the dashboard installation callback route so GitHub can return `installation_id` to Firmcode after install/update:

```text
https://firmcode.firmoncloud.com/github/installations/callback
```

In the setup URL flow, enable **Redirect on update** so repository-access changes return to Firmcode instead of leaving the user on GitHub's installation configuration page. GitHub disables the setup URL field when OAuth during installation is enabled.

Keep `APP_URL=https://firmcode.firmoncloud.com` on the API service and `API_URL=https://firmcodeapi.firmoncloud.com` on the web service so dashboard server actions and callbacks forward securely to the API token exchange endpoint. `NEXT_PUBLIC_API_URL` may mirror the API URL, but it must not point at the web frontend.

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

Repository-level dashboard configuration is persisted in PostgreSQL separately from environment defaults. Developers and Admins can fetch and update repository automation and review policy fields through the dashboard API; updates are workspace-scoped, preserve unspecified fields, and record update timestamps plus the authenticated user ID that made the change.

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

The API validates `NODE_ENV`, database settings, InsForge auth settings, and GitHub App credentials during startup. GitHub private keys may be raw PEM, escaped-newline PEM, or base64-encoded PEM. The web package reads InsForge public base URL/anon key settings, sign-in/sign-up URLs, after-auth redirects, and API URL.

## Deployment Targets

- Local and Vercel web need `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_INSFORGE_BASE_URL`, `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, and any public dashboard config.
- Coolify API needs `DATABASE_URL`, `REDIS_URL`, `INSFORGE_BASE_URL`, GitHub App credentials, CORS origins, and webhook secret.
- Coolify worker needs `DATABASE_URL`, `REDIS_URL`, LLM credentials, Semgrep settings, Tree-sitter settings, and GitHub App credentials if publishing from worker.
