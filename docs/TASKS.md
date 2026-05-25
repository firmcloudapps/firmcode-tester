# Firmcode Implementation Tasks And Timeline

## Timeline Summary

The MVP is scoped as a 10-week build. A solo developer can compress or stretch this, but each phase is designed to produce testable increments.

| Phase | Duration | Outcome |
| --- | --- | --- |
| 0 | 2 days | Monorepo scaffold, tooling, Docker-first Compose, Vercel/Coolify notes |
| 1 | 4 days | GitHub App config and webhook ingestion |
| 2 | 4 days | PR diff extraction, hunk parsing, line mapping |
| 3 | 3 days | PostgreSQL schema, BullMQ queue, worker lifecycle |
| 4 | 4 days | Semgrep changed-file scanning |
| 5 | 5 days | Tree-sitter semantic extraction |
| 6 | 5 days | LLM review engine and JSON validation |
| 7 | 4 days | GitHub summary and inline comment publishing |
| 8 | 4 days | CI/CD failure explanation |
| 9 | 7 days | Clerk-authenticated Next.js dashboard, role-gated APIs, and SaaS account flows |
| 10 | 5 days | Hardening, observability, privacy, docs, release candidate |
| 11 | 5 days | Continuous repository scanning, persisted codebase findings, and PR review enrichment |

## Phase 0: Scaffold And Local Runtime

### Task 0.0: Reference Reading Baseline

Read `prompts/main.md`, `docs/PRD.md`, `docs/REFERENCE_ANALYSIS.md`, `docs/ADR.md`, `docs/ENVIRONMENT.md`, `docs/AUTHORIZATION.md`, `docs/PRIVACY_RETENTION.md`, `docs/LLM_STRATEGY.md`, `docs/WEBHOOK_IDEMPOTENCY.md`, `docs/LARGE_PR_HANDLING.md`, `docs/DASHBOARD_DESIGN.md`, `AGENTS.md`, and `CLAUDE.md`. For the component being implemented, inspect the relevant reference code in `pr-agent/`, `semgrep/`, or `tree-sitter/` before writing Firmcode code.

Acceptance criteria:

- Implementation notes identify which reference files informed the task.
- No code is imported from or written into the reference repositories.
- Any adapted pattern is expressed through Firmcode-owned interfaces and tests.
- Implementation notes identify which planning docs apply to the task.

Tests:

- Not applicable as a standalone code task; enforce through PR review checklist and task notes.

### Task 0.1: Create Monorepo Structure

Create `apps/api`, `apps/web`, `apps/worker`, `packages/shared`, `packages/prompts`, and `infra/docker`.

Acceptance criteria:

- `npm install` works at repo root.
- API, web, and worker have independent package/runtime configuration.
- Web app is configured for TypeScript and Tailwind CSS.
- Shared contracts can be imported by API and web.
- Worker has Python packaging and test setup.

Tests:

- Root build script succeeds.
- Minimal API health test passes.
- Minimal web page or component test passes.
- Minimal worker pytest passes.

### Task 0.3: Clerk And NeonDB Foundation

Add project-level configuration conventions for Clerk authentication, Clerk Organizations/workspaces, Clerk Billing, and NeonDB/PostgreSQL.

Acceptance criteria:

- Environment variables for Clerk and NeonDB are documented.
- Web app has Clerk provider wiring planned or scaffolded.
- API/database config uses `DATABASE_URL` compatible with NeonDB.
- Billing page is defined as Clerk-managed subscription portal entry point.
- SaaS account-management requirements are documented: sign-up/sign-in, user profile, workspace switcher, member management, billing portal, role mapping, plan/capability metadata, and tenant isolation.

Tests:

- Config validation tests for required Clerk and database variables.
- Database connection smoke test uses PostgreSQL-compatible connection string.

### Task 0.4: Environment And Local Development Docs

Create `.env.example` files and local development setup docs based on `docs/ENVIRONMENT.md` and `docs/LOCAL_DEVELOPMENT.md`.

Acceptance criteria:

- Root `.env.example` documents all required MVP variables.
- API, web, and worker env examples are present if they have runtime-specific variables.
- Local setup guide explains Clerk, NeonDB/local Postgres, GitHub App, webhook tunnel, Redis, worker, and dry-run fixture setup.
- No secrets are committed.

Tests:

- Config validation tests fail on missing required variables.
- Local database connection smoke test is documented or automated.

### Task 0.2: Add Docker Compose

Add local Compose services for API, worker, and Redis. API and worker must use NeonDB through `DATABASE_URL`; do not add a local PostgreSQL service. The Next.js dashboard runs independently with Next.js dev locally and deploys to Vercel in production.

Acceptance criteria:

- `docker compose up` starts API, worker, and Redis.
- `docker compose up --build` builds API and worker images from clean Dockerfiles.
- API can connect to NeonDB and Redis.
- Worker can connect to Redis and read environment variables.
- Worker container includes Semgrep CLI and Tree-sitter runtime dependencies.
- Local Next.js dev can reach the API through `NEXT_PUBLIC_API_URL`.
- Health endpoints are reachable.
- API and worker Compose entrypoints are close to Coolify production entrypoints where practical.

Tests:

- Compose smoke test checks API `/health`.
- Worker startup test logs successful queue connection.
- Container build smoke test for API and worker.

### Task 0.2a: Hybrid Deployment Notes

Create `infra/deploy/vercel.md` and `infra/deploy/coolify.md` documenting the hybrid deployment model from `docs/DEPLOYMENT.md`.

Acceptance criteria:

- Documents Vercel web deployment for Next.js.
- Documents Coolify Docker deployment for API and worker.
- Documents Redis and NeonDB deployment shape.
- Lists build contexts, Dockerfile paths, ports, health checks, env vars, migration command, CORS origins, and worker scaling notes.
- Explains how local Docker Compose maps to Vercel/Coolify services.
- Documents deployment order and rollback notes.

Tests:

- Release checklist includes Vercel build plus Coolify build/deploy verification.

## Phase 1: GitHub App And Webhooks

### Task 1.1: GitHub App Configuration

Implement typed config for GitHub App ID, private key, webhook secret, client ID, and client secret.

Acceptance criteria:

- Missing required GitHub config fails fast in non-test environments.
- Private key supports escaped newline and base64 formats.
- Config values are never logged.

Tests:

- Unit tests for config validation.
- Unit tests for private key normalization.

### Task 1.2: Webhook Signature Verification

Implement raw-body HMAC SHA-256 verification for `POST /webhooks/github`.

Acceptance criteria:

- Valid signatures are accepted.
- Invalid signatures return `401`.
- Unsupported events return `202`.
- Payload is parsed only after signature verification.

Tests:

- Fixture tests with valid and invalid signatures.
- Controller integration test for supported and unsupported events.

### Task 1.3: Pull Request Event Normalization

Normalize PR opened, synchronize, reopened, and ready_for_review events.

Acceptance criteria:

- Installation, repository, and PR records are upserted.
- Draft PRs are ignored unless configured.
- Each supported event creates one review run.
- Duplicate delivery IDs do not create duplicate jobs.

Tests:

- Fixture tests for each supported action.
- Idempotency test for duplicate delivery.

### Task 1.4: Webhook Idempotency And Superseded Runs

Implement delivery storage, duplicate detection, event ordering, and superseded-run protection from `docs/WEBHOOK_IDEMPOTENCY.md`.

Acceptance criteria:

- GitHub delivery IDs are persisted with processing status.
- Duplicate delivery IDs return `202` without duplicate jobs.
- New PR synchronize events supersede queued/running older head SHA runs where safe.
- Publisher verifies current PR head SHA before posting.

Tests:

- Duplicate delivery fixture test.
- Old run publishing prevention test.
- Same PR new head SHA test.

## Phase 2: Diff Intelligence

### Task 2.1: GitHub PR File Fetcher

Fetch PR files, patches, additions, deletions, status, and raw file contents at `head_sha`.

Acceptance criteria:

- Handles pagination.
- Skips deleted and binary files for content fetch.
- Records unsupported or oversized files with reason.
- Retries transient GitHub failures.

Tests:

- Mock GitHub pagination test.
- Deleted/binary/oversized file tests.

### Task 2.2: Unified Diff Parser

Parse unified diff patches into files, hunks, and old/new line mappings.

Acceptance criteria:

- Tracks changed new-side lines accurately.
- Supports additions, deletions, and context lines.
- Exposes helper to decide if a finding can be posted inline.

Tests:

- Golden fixture tests for typical, deletion, rename, and multi-hunk diffs.
- Edge test for no-newline marker.

### Task 2.3: Risk Classification

Detect risky changes based on paths, languages, file types, and diff content.

Acceptance criteria:

- Flags auth, secrets, migrations, dependencies, infra, public API, and CI workflow changes.
- Risk flags are persisted per changed file.
- Risk flags are included in context packs.

Tests:

- Path and content classifier unit tests.
- Fixture test for mixed application and infra PR.

### Task 2.4: Large PR And Generated File Handling

Implement large-PR thresholds, generated/vendor skip rules, prioritized mode, summary-only mode, and skipped-file reporting from `docs/LARGE_PR_HANDLING.md`.

Acceptance criteria:

- Large PR mode is triggered by configurable file, diff, line, token, or runtime thresholds.
- Generated/vendor/minified/binary files are skipped or summarized with explicit reasons.
- High-risk files are prioritized when budget is constrained.
- Skipped file reasons are persisted and visible in review run artifacts.

Tests:

- Huge diff fixture.
- Many-files fixture.
- Lockfile/generated/minified skip tests.
- Large PR with Semgrep finding prioritization test.

## Phase 3: Queue And Worker Lifecycle

### Task 3.1: Database Migrations

Create migrations for installations, repositories, pull requests, review runs, changed files, artifacts, findings, and published comments.

Acceptance criteria:

- Migrations run from a clean database.
- Foreign keys and unique constraints enforce idempotency.
- Common dashboard queries have indexes.

Tests:

- Migration smoke test.
- Repository upsert integration test.

### Task 3.2: BullMQ Review Queue

Add queue producer in API and worker consumer lifecycle.

Acceptance criteria:

- API enqueues `review.pull_request` jobs.
- Worker updates review run status to running/succeeded/failed.
- Retry policy handles transient failures.
- Failed job records error code and message.

Tests:

- Integration test from webhook fixture to queued job.
- Worker lifecycle test with success and failure handlers.

### Task 3.3: Worker Contract Schema

Define shared JSON contracts for review job input, diff artifacts, Semgrep findings, Tree-sitter artifacts, LLM output, and publish payloads.

Acceptance criteria:

- API and worker agree on schema versions.
- Invalid worker payloads fail validation with useful errors.
- Contract fixtures live in `packages/shared` or `apps/worker/tests/fixtures`.

Tests:

- JSON schema validation tests.
- Backward compatibility test for current schema version.

## Phase 4: Semgrep Integration

### Task 4.1: Semgrep Process Wrapper

Implement a worker wrapper that runs Semgrep and captures JSON output, stderr, exit code, and duration.

Acceptance criteria:

- Semgrep timeout is configurable.
- Non-finding exit statuses are handled correctly.
- Results are normalized to `findings`.
- Raw output is stored as an artifact.

Tests:

- Unit tests for Semgrep JSON normalization.
- Process wrapper test using a small fixture file.

### Task 4.2: Changed-File Scan Workspace

Create an isolated temporary scan workspace for changed files.

Acceptance criteria:

- Deleted and unsupported files are excluded.
- File paths preserve repository-relative names.
- Cleanup runs after success and failure.
- Scan workspace cannot escape configured temp directory.

Tests:

- Workspace creation test.
- Path traversal rejection test.

### Task 4.3: Infrastructure Rules

Add local Semgrep config for Terraform, Kubernetes, Dockerfile, and GitHub Actions risks.

Acceptance criteria:

- Rules detect privileged containers, unpinned actions, Docker root user, broad IAM permissions, and missing resource limits.
- Infra findings include remediation guidance.
- Rule set can run locally through documented command.

Tests:

- Semgrep rule tests against positive and negative fixtures.

## Phase 5: Tree-sitter Integration

### Task 5.1: Parser Registry

Create a Tree-sitter language resolver and parser registry for MVP languages.

Acceptance criteria:

- File extensions map to languages.
- Unsupported languages return explicit status.
- Parser load failures do not fail the whole review.

Tests:

- Language mapping tests.
- Parser load success/failure tests.

### Task 5.2: Semantic Extractor

Extract symbols, imports, classes, functions, methods, and changed hunk scopes.

Acceptance criteria:

- Extracted symbols include name, kind, start line, end line, and changed flag.
- Hunk scopes identify enclosing function/class where possible.
- Parse errors are recorded as artifacts.

Tests:

- Golden extraction fixtures for TypeScript, Python, Go, and YAML.
- Hunk-to-symbol association tests.

### Task 5.3: Syntax-Aware Chunking

Build context chunks around changed hunks and semantic scopes.

Acceptance criteria:

- Chunks stay under configurable token/character budgets.
- Changed lines are always included.
- Enclosing symbols and imports are included when relevant.

Tests:

- Chunk budget tests.
- Fixture tests for large files and nested functions.

## Phase 6: LLM Review Engine

### Task 6.1: Prompt Templates

Create prompt templates for review, summary, test suggestions, infrastructure review, and CI explanation.

Acceptance criteria:

- Prompts delimit untrusted content.
- Prompts require structured JSON.
- Prompts include evidence and confidence requirements.
- Prompt templates are versioned.
- Prompt lifecycle follows `docs/LLM_STRATEGY.md`.

Tests:

- Snapshot tests for rendered prompts.
- Prompt injection fixture test verifies delimiter language is present.
- Prompt version metadata test.

### Task 6.2: LLM Client Abstraction

Implement provider-neutral LLM client interface.

Acceptance criteria:

- Supports model, temperature, max tokens, timeout, and retry config.
- Captures token usage and latency.
- Redacts secrets from logged requests.
- Can run with a fake client in tests.
- Provider configuration follows `docs/LLM_STRATEGY.md`.

Tests:

- Fake client integration tests.
- Retry and timeout tests.

### Task 6.4: LLM Evaluation Fixtures

Add golden fixtures and evaluation checks from `docs/LLM_STRATEGY.md`.

Acceptance criteria:

- Fixtures cover small bug, security, infrastructure, CI failure, large PR, generated-file-heavy PR, and no-issue PR.
- Evaluation checks enforce valid JSON, changed-line inline findings, evidence, severity restraint, Semgrep preservation, and comment-count limits.
- Prompt versions are stored with expected outputs.

Tests:

- Evaluation test suite runs locally without live LLM by using frozen responses.
- Schema and changed-line checks run against every fixture.

### Task 6.3: Output Validation And Deduplication

Validate model JSON and deduplicate findings before publishing.

Acceptance criteria:

- Invalid JSON triggers one repair attempt, then fails safely.
- Inline findings must map to changed lines.
- Findings without evidence are downgraded or rejected.
- Duplicate Semgrep/LLM findings collapse into one output.

Tests:

- Schema validation tests.
- Changed-line enforcement tests.
- Deduplication fixture tests.

## Phase 7: GitHub Publishing

### Task 7.1: Summary Comment Publisher

Post or update Firmcode summary comment on a PR.

Acceptance criteria:

- Summary includes marker for future updates.
- Re-runs update previous Firmcode summary instead of spamming.
- Summary includes risk, changed components, findings, and tests.

Tests:

- Mock GitHub create/update comment tests.
- Markdown snapshot test.

### Task 7.2: Inline Review Publisher

Post inline comments through GitHub review API.

Acceptance criteria:

- Comments are only posted on changed lines.
- Comments include severity and actionable fix.
- Max inline comment cap is enforced.
- Published comment IDs are persisted.

Tests:

- Review payload formatting tests.
- Comment cap and severity ordering tests.

### Task 7.3: Dry Run Mode

Add config to run analysis without posting comments.

Acceptance criteria:

- Dry run persists would-be comments and summary.
- Logs clearly mark dry run behavior.
- Dashboard can show dry run outputs.

Tests:

- Publisher tests verify no GitHub write calls in dry run.

## Phase 8: CI/CD Failure Analysis

### Task 8.1: Check Run And Workflow Run Fetching

Fetch failed check runs and workflow logs for a PR head SHA.

Acceptance criteria:

- Handles GitHub Actions logs when permission exists.
- Records unavailable logs with reason.
- Truncates and redacts logs before LLM use.

Tests:

- Mock GitHub check run tests.
- Log truncation and redaction tests.

### Task 8.2: CI Failure Explanation

Generate concise root-cause explanation and suggested fixes.

Acceptance criteria:

- Groups failures by job/step.
- Detects common flaky test signals.
- Posts CI explanation in summary or separate comment.

Tests:

- Golden CI log explanation fixtures.
- Flaky pattern classifier tests.

## Phase 9: Dashboard

### Task 9.0: Complete Clerk Authentication Foundation

Replace the current dashboard auth scaffold and local header shim with a complete Clerk-backed authentication flow.

Acceptance criteria:

- `apps/web` installs and wires `@clerk/nextjs`.
- The root layout uses a real `ClerkProvider`.
- Clerk sign-in and sign-up pages exist at `/sign-in/[[...sign-in]]` and `/sign-up/[[...sign-up]]`.
- Sign-in and sign-up use the dedicated auth-page design from `docs/DASHBOARD_DESIGN.md`: light-mode unauthenticated shell, constrained Clerk panel, compact Firmcode context, responsive mobile layout, and no marketing hero treatment.
- Next.js middleware protects all dashboard pages and dashboard route handlers.
- Dashboard shell uses Clerk `UserButton` and `OrganizationSwitcher` where organizations are enabled.
- The active workspace displayed in the shell comes from Clerk organization/personal workspace state, not static placeholder text.
- Web server components and route handlers derive the user/session from Clerk `auth()`.
- Web-to-API requests include `Authorization: Bearer <Clerk session token>`.
- `FIRMCODE_DASHBOARD_WORKSPACE_ID`, `FIRMCODE_DASHBOARD_CLERK_USER_ID`, and `FIRMCODE_DASHBOARD_CLERK_BILLING_CAPABILITY` are removed from production request flow and kept only as explicit test/local bypass fixtures.
- `apps/api` installs a Clerk server verification package such as `@clerk/backend`.
- API dashboard routes use a shared Nest guard that verifies Clerk session/JWT tokens before controller logic runs.
- API request context includes Clerk user ID, active Clerk organization ID when available, resolved workspace ID, role, and capabilities.
- Workspace rows and memberships are resolved or created from Clerk organization/user state for first-login flows.
- Spoofed `x-firmcode-user-id` headers are ignored or rejected in production.

Tests:

- Web route protection tests for authenticated and unauthenticated users.
- Sign-in/sign-up route rendering tests.
- Sign-in/sign-up visual or rendered-markup tests for desktop/mobile layout, Clerk appearance hooks, and no dashboard shell leakage.
- Dashboard shell tests for Clerk user menu, organization switcher, and active workspace display.
- API guard tests for missing token, invalid token, expired token, valid personal workspace token, and valid organization token.
- Tests proving client-provided user headers cannot impersonate another Clerk user.
- Integration test proving the dashboard can call a protected API route with a Clerk token.

### Task 9.1: Repository And Run Views

Build dashboard pages for repositories and review runs.

Acceptance criteria:

- UI follows `docs/DASHBOARD_DESIGN.md`.
- Pages are implemented in TypeScript with Tailwind CSS.
- Repository list shows enabled status and last review.
- Review run list filters by status, repo, and date.
- Run detail shows files, findings, artifacts, logs, and published comments.
- Clerk-authenticated users can access dashboard pages.

Tests:

- Component tests for loading, empty, and error states.
- API integration tests for list/detail endpoints.
- Visual smoke check for desktop and mobile layouts.

### Task 9.2: Retry And Configuration Controls

Allow retrying failed runs and toggling repository automation.

Acceptance criteria:

- Retry button creates a new queued job or retries existing failed run.
- Repository enable/disable persists.
- UI prevents duplicate retry clicks.

Tests:

- UI interaction tests.
- API authorization and validation tests.

### Task 9.3: Overview, Findings, Settings, And Billing Shell

Build the dashboard overview, findings inbox, settings shell, and billing shell.

Acceptance criteria:

- Overview includes review activity, security findings, CI failures, repositories monitored, recent review runs, and needs-attention panel.
- Findings page supports severity, source, category, repository, status, posted inline, and date filters.
- Settings page includes General, GitHub Account/OAuth, GitHub App, Members, API Keys, Data Retention, and Notifications tabs or equivalent sections.
- Settings exposes SaaS account-management entry points: Clerk profile, workspace/organization profile, member management where allowed, required GitHub OAuth connection, GitHub App installation status, and explicit disabled states for unavailable account features.
- Billing page displays plan/usage placeholders or counters, role-gated plan capability messaging, and links to Clerk Billing subscription management.
- All screens use the approved light-mode Tailwind design.

Tests:

- Component tests cover loading, empty, error, and populated states.
- Clerk-gated billing/settings access test.
- Visual smoke check for primary dashboard pages.

### Task 9.4: App Authorization In Dashboard APIs

Implement Clerk-backed app authorization rules from `docs/AUTHORIZATION.md`.

Acceptance criteria:

- All dashboard controllers use the shared Clerk auth guard/request context from Task 9.0.
- Every dashboard API checks workspace membership and resource ownership.
- Admin/Developer role capabilities are enforced.
- Billing and sensitive settings require elevated role.
- Raw artifact access is role-gated.
- Tenant isolation is enforced for every SaaS account resource, including workspace settings, members, billing context, GitHub OAuth identity, GitHub installations, repositories, review runs, findings, policies, artifacts, and audit events.
- Sensitive account and integration actions write audit events.
- List endpoints are tenant-scoped and require authentication; repository, review-run, finding, pull-request, and CI-failure lists must not expose global data.
- API controllers no longer trust `x-firmcode-user-id`; user identity comes only from verified Clerk claims.
- Optional workspace selection is accepted only after verifying the authenticated user belongs to that workspace.
- Missing/invalid Clerk token returns `401`; authenticated users without capability receive `403`; cross-workspace resource lookups return `404` where existence would leak tenant data.

Tests:

- API authorization tests for every dashboard resource type.
- Role capability tests.
- Cross-workspace access denial tests.
- Spoofed-header rejection tests.
- Tenant-scoped list endpoint tests.
- Audit-event persistence tests for OAuth connect/disconnect, GitHub installation connect/sync, repository enablement, policy update, raw artifact access, billing capability change, manual scan, and retry.

### Task 9.5: GitHub App Setup And Repository Sync Dashboard Flow

Implement the dashboard GitHub OAuth account connection plus GitHub App install/status/sync flow so Connect GitHub and Sync GitHub are real product actions rather than placeholder links.

Acceptance criteria:

- `/github/installations` is an implemented Clerk-authenticated dashboard page or route that shows installation status, setup instructions, and a GitHub App install entry point.
- Every signed-in Firmcode user must connect a GitHub OAuth account before using GitHub-backed dashboard workflows; OAuth identifies the user, while GitHub App installation tokens remain the only tokens used for repository review, sync, and PR comment publishing.
- A PR Review workspace is implemented or planned in the same flow, combining provider tabs, required GitHub OAuth account status, GitHub App installation status, repository readiness, enabled state, configure actions, and run/retry actions.
- GitHub App installation callback/status handling is documented and wired to workspace ownership checks.
- Dashboard APIs list installations for the caller workspace and sync installation repository metadata.
- Repository-level sync is available only for repositories owned by the caller workspace.
- Developers can connect GitHub OAuth, add/sync repositories, enable automation, and run/retry reviews after OAuth is connected, subject to plan limits. Admins can additionally manage billing, member access, global workspace settings, and support/safety controls.
- Connect/sync buttons show loading, success, error, and disabled states and never link to missing routes.
- Empty states explain how to connect GitHub without exposing secrets or private installation tokens.

Tests:

- API tests for OAuth connection state, installation listing, installation sync, repository sync, ownership denial, and role denial.
- Component tests for missing OAuth, no installation, connected installation, sync loading/error/success, and unauthorized states.
- Route/navigation tests proving Connect GitHub and Sync GitHub do not 404.

### Task 9.6: Repository Detail And Rules/Policies Dashboard Pages

Build the missing repository detail/configuration and Rules / Policies pages that are referenced by the dashboard navigation and repository actions.

Acceptance criteria:

- `/repositories/:id` is implemented with Overview, Pull Requests, Findings, Configuration, and Activity tabs.
- Repository detail verifies workspace ownership and returns 404 for cross-workspace or missing repositories.
- Configuration tab uses existing repository review configuration APIs and respects role capabilities.
- `/rules` is implemented with review preferences, comment policy, prompt instructions, ignored paths, Semgrep/analysis toggles, and infrastructure/security policy sections.
- Repository-level rules/policy mutations are available to Developers and Admins. Global workspace, retention, API key, billing, and support/safety policy mutations require Admin.
- Repository Configure links route to implemented pages and do not 404.

Tests:

- API tests for repository detail, repository activity, rules read/update, role denial, and cross-workspace denial.
- Component tests for repository tabs, configuration controls, rules/policies loading/empty/error/populated states, and read-only role behavior.
- Navigation tests for repository Configure and Rules / Policies destinations.

### Task 9.7: Pull Requests And CI Failures Dashboard Pages

Build the missing Pull Requests and CI Failures dashboard pages referenced by the app shell and overview needs-attention model.

Acceptance criteria:

- `/pull-requests` lists PRs with repository, status, risk, review status, author, and date filters.
- PR detail shows summary, changed components, risk analysis, review timeline, findings, metadata, branches, commit SHA, changed files, duration, and GitHub link.
- `/ci-failures` lists failed workflows/jobs with repository, PR, failed job, root cause summary, flaky suspicion, suggested fix, and created time.
- CI failure detail shows root cause, suggested fixes, failed jobs, collapsed redacted log excerpts, and related review run/artifact links.
- API endpoints enforce workspace membership and resource ownership.
- Overview and sidebar links point only to implemented PR/CI pages when active.

Tests:

- API tests for PR list/detail, CI failure list/detail, filters, ownership denial, and malformed filters.
- Component tests for loading, empty, error, populated, desktop/mobile states.
- Navigation tests proving Pull Requests and CI Failures routes do not 404 once enabled.

### Task 9.8: Dashboard Navigation Readiness And No-Dead-Link QA

Make dashboard navigation truthful: implemented destinations are active, planned destinations are disabled, and no primary action leads to a 404.

Acceptance criteria:

- Sidebar, topbar, overview needs-attention links, repository row actions, settings actions, and billing actions are audited.
- Active links point only to implemented app routes or external Clerk/GitHub URLs.
- Planned but unimplemented actions render as disabled controls with accessible labels and titles.
- Tests fail if a dashboard nav item or primary action points at an unimplemented internal route.
- Visual QA confirms the full-width brand-refresh layout still works on desktop and mobile after navigation changes.

Tests:

- Component or route manifest tests for all dashboard navigation destinations.
- Browser smoke test across Overview, Repositories, Review Runs, Findings, Settings, and Billing.
- Regression test for disabled planned actions.

## Phase 10: Hardening And Release Candidate

### Task 10.1: Observability

Add structured logs, metrics, and trace IDs across webhook, queue, worker, and publisher.

Acceptance criteria:

- Every review run has a correlation ID.
- Logs include stage duration and failure reason.
- Health/readiness checks cover database and Redis.

Tests:

- Logger context tests.
- Readiness integration test.

### Task 10.2: Security Hardening

Review secret handling, rate limits, validation, and retention.

Acceptance criteria:

- Webhook endpoint is rate-limited.
- Secrets are redacted from logs.
- Retention policy for artifacts is configurable.
- Repository allowlist is supported for MVP.
- Privacy and retention behavior follows `docs/PRIVACY_RETENTION.md`.

Tests:

- Rate-limit test.
- Redaction tests.
- Allowlist tests.
- Retention cleanup tests.

### Task 10.4: Operations Runbook And Release Checklist

Finalize operational readiness using `docs/OPERATIONS_RUNBOOK.md` and `docs/RELEASE_CHECKLIST.md`.

Acceptance criteria:

- Runbook covers failed jobs, GitHub rate limits, webhook failures, Semgrep timeouts, Tree-sitter failures, LLM failures, publishing failures, NeonDB issues, and Redis backlog.
- Release checklist is executable for local/staging release.
- Health and readiness endpoints reflect database and Redis status.
- Dry-run release smoke test is documented.

Tests:

- Readiness integration test.
- Release smoke test using synthetic dry-run fixture.

### Task 10.3: End-To-End Review Fixture

Create a synthetic PR review fixture that runs from webhook to generated comments in dry run mode.

Acceptance criteria:

- One command runs the full dry-run review.
- Outputs summary, inline comments, findings, and artifacts.
- Fixture includes application code, infrastructure code, Semgrep finding, and CI failure.

Tests:

- E2E smoke test in CI/local.

## Phase 11: Continuous Codebase Scanning And Review Enrichment

### Task 11.1: Codebase Scan Persistence And Contracts

Add PR-independent persistence and shared contracts for repository scan runs, scan artifacts, and scan findings.

Acceptance criteria:

- Migrations add `codebase_scan_runs` and `codebase_scan_findings` with repository ownership, status, trigger, commit SHA, stable dedupe keys, finding status, first/last seen timestamps, and resolved timestamps.
- Shared TypeScript and Python contracts define codebase scan job input, scan run artifact metadata, normalized scan finding, and review-enrichment payloads.
- Finding categories, severities, confidence, evidence, recommendations, and source values match the existing PR finding model where practical.
- Database indexes support repository scan history, open finding inbox queries, dedupe, and touched-file lookup.
- Retention and redaction expectations are documented for scan artifacts and findings.

Tests:

- Migration smoke tests.
- Contract fixture tests in TypeScript and Python.
- Store tests for inserting/updating scan runs, upserting findings by dedupe key, and resolving stale findings after a successful scan.

### Task 11.2: Codebase Scan Queue And Scheduling

Add BullMQ scheduling for initial, manual, and recurring repository scans.

Acceptance criteria:

- Repository sync, GitHub App installation connection, and repository automation enablement enqueue an initial codebase scan for enabled repositories.
- A repeatable schedule enqueues scans on a configurable cadence without duplicating active jobs for the same repository and commit SHA.
- Dashboard/manual scan requests create idempotent scan jobs after authorization and repository ownership checks.
- Scan jobs use GitHub App installation tokens, not user OAuth tokens.
- Queue metrics and structured logs include scan run ID, repository, trigger, commit SHA, status, and duration.

Tests:

- API integration tests for initial scan enqueue after installation/repository sync.
- Queue tests for repeatable schedule idempotency and active-job dedupe.
- Authorization tests for manual scan enqueue.

### Task 11.3: Worker Codebase Scan Pipeline

Implement the Python worker pipeline that scans an enabled repository at its default branch.

Acceptance criteria:

- Worker resolves the latest default branch commit SHA and skips already-successful scans for that SHA.
- Worker creates a bounded temporary checkout or file workspace with ignored paths, generated-file handling, file count limits, byte limits, and skipped-path accounting.
- Semgrep scans supported repository files and infrastructure code using existing scanner normalization.
- Tree-sitter extracts symbol/component context for supported files where practical.
- Optional LLM review produces concise bug/debug summaries and recommendations from deterministic evidence only.
- Findings are normalized, redacted, persisted, deduplicated, and stale findings are marked resolved.
- Scan failures persist structured errors and never leave repository tokens or raw secrets in logs.

Tests:

- Worker unit tests for skip-if-same-SHA, workspace selection, skipped paths, Semgrep normalization, and stale finding resolution.
- Golden fixture test for a small repository producing persisted bug/security findings and recommendations.
- Failure-path tests for GitHub fetch errors, Semgrep process errors, oversized repos, and redaction.

### Task 11.4: Review Enrichment From Codebase Findings

Enrich PR review summaries with relevant unresolved findings from recent repository scans.

Acceptance criteria:

- PR review loads unresolved codebase scan findings for changed files and touched components.
- High/critical repository findings from touched components can appear in the Code Review summary even when they are not on changed lines.
- Inline comments remain restricted to current PR changed lines.
- Code Review section clearly separates current PR findings from existing codebase findings when both are present.
- Existing codebase findings include severity, path, evidence summary, and recommendation.
- Dedupe prevents reposting the same issue as both a PR finding and a codebase finding.

Tests:

- Summary renderer tests for PR-only findings, codebase-only findings, and mixed findings.
- Deduplication tests between current review findings and codebase findings.
- Integration test from stored scan finding plus PR changed file to enriched summary comment.

### Task 11.5: Dashboard And Operations For Codebase Scans

Expose codebase scan status, findings, and controls in the dashboard and runbooks.

Acceptance criteria:

- Repository list/detail show latest codebase scan status, last scan time, open finding count, and manual scan action.
- Findings inbox can filter PR findings and codebase scan findings by repository, severity, source, category, status, and date.
- Repository configuration exposes scan cadence, enabled state, ignored paths, severity threshold, and maximum scan limits.
- Developers and Admins can view scan findings, trigger scans, suppress findings, or mark findings false positive where workspace policy and plan limits allow. Admins retain global policy and safety controls.
- Operations runbook covers scan backlog, GitHub rate limits, scan failures, Semgrep timeouts, stale findings, and retention cleanup.

Tests:

- Dashboard API tests for scan runs, scan findings, manual scan, and finding status updates.
- Component tests for repository scan status, manual scan states, findings filters, and role-gated actions.
- Runbook/readiness documentation check for scan operations.
