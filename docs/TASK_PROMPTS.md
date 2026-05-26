# Firmcode Task Prompts

Use these prompts to hand individual implementation tasks to a coding agent. Replace bracketed values when needed.

Dashboard-specific prompts live in `docs/DASHBOARD_PROMPTS.md`.

Every task starts with this instruction:

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/REFERENCE_ANALYSIS.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Treat pr-agent, semgrep, and tree-sitter as reference implementations only. Do not import from, copy into, or modify those repositories. Read docs/REFERENCE_ANALYSIS.md and inspect the relevant reference files before implementing analogous Firmcode behavior.
```

Frontend tasks must also follow `docs/DASHBOARD_DESIGN.md`: clean modern light mode, TypeScript, Tailwind CSS, Clerk for auth/billing, and NeonDB-backed application data.

## Task 0.1: Create Monorepo Structure

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: prompts/main.md, docs/PRD.md, docs/ADR.md, docs/ENVIRONMENT.md, docs/AUTHORIZATION.md, docs/PRIVACY_RETENTION.md, docs/LLM_STRATEGY.md, docs/WEBHOOK_IDEMPOTENCY.md, docs/LARGE_PR_HANDLING.md, docs/DASHBOARD_DESIGN.md, docs/DEPLOYMENT.md, docs/REFERENCE_ANALYSIS.md, CLAUDE.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Read prompts/main.md, docs/PRD.md, docs/REFERENCE_ANALYSIS.md, docs/ADR.md, docs/ENVIRONMENT.md, docs/AUTHORIZATION.md, docs/PRIVACY_RETENTION.md, docs/LLM_STRATEGY.md, docs/WEBHOOK_IDEMPOTENCY.md, docs/LARGE_PR_HANDLING.md, docs/DASHBOARD_DESIGN.md, AGENTS.md, and CLAUDE.md. Create the initial Firmcode monorepo structure with apps/api, apps/web, apps/worker, packages/shared, packages/prompts, and infra/docker. Use NestJS for the API scaffold, Next.js with TypeScript and Tailwind CSS for the web scaffold, Python packaging for the worker, and shared TypeScript contracts. Add minimal health checks and one passing test per runtime. Do not modify pr-agent, semgrep, or tree-sitter reference directories. Acceptance criteria are in docs/TASKS.md Task 0.1.
```

## Task 0.3: Clerk And NeonDB Foundation

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/ENVIRONMENT.md, docs/AUTHORIZATION.md, docs/DASHBOARD_DESIGN.md, docs/DEPLOYMENT.md, docs/PRD.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Add configuration conventions for Clerk authentication, Clerk Billing, and NeonDB/PostgreSQL. Document required environment variables, wire or plan the Clerk provider in the Next.js app, ensure API database config uses DATABASE_URL compatible with NeonDB, and define Billing as a Clerk-managed subscription portal entry point. Add config validation tests for Clerk/database variables and a database connection smoke test. Acceptance criteria are in docs/TASKS.md Task 0.3.
```

## Task 0.4: Environment And Local Development Docs

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/ENVIRONMENT.md, docs/LOCAL_DEVELOPMENT.md, docs/DEPLOYMENT.md, docs/RELEASE_CHECKLIST.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Create .env.example files and local development setup docs based on docs/ENVIRONMENT.md and docs/LOCAL_DEVELOPMENT.md. Document Clerk, NeonDB, GitHub App, webhook tunnel, Redis, worker, LLM provider, Semgrep, Tree-sitter, and dry-run fixture setup. Ensure no secrets are committed. Add config validation tests for missing required variables and document or automate a NeonDB connection smoke test. Acceptance criteria are in docs/TASKS.md Task 0.4.
```

## Task 0.2: Add Docker Compose

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/ADR.md, docs/DEPLOYMENT.md, docs/LOCAL_DEVELOPMENT.md, docs/ENVIRONMENT.md, docs/RELEASE_CHECKLIST.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Implement Docker-first local development for Firmcode because the API and worker will deploy as Docker containers on Coolify, while the Next.js dashboard will run independently with Next.js dev locally and deploy to Vercel in production. Include api, worker, and redis services in local Compose. Use NeonDB through `DATABASE_URL`; do not add a local PostgreSQL service. Add production-minded Dockerfiles for API and worker. Wire DATABASE_URL, REDIS_URL, service ports, health checks, CORS origins, and container networking. Ensure the worker image includes Semgrep CLI and Tree-sitter runtime dependencies. Add smoke tests or documented commands proving API and worker images build and the API/worker can reach NeonDB and Redis from inside Docker. Acceptance criteria are in docs/TASKS.md Task 0.2.
```

## Task 0.2a: Hybrid Deployment Notes

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/DEPLOYMENT.md, docs/ADR.md, docs/ENVIRONMENT.md, docs/LOCAL_DEVELOPMENT.md, docs/RELEASE_CHECKLIST.md, docs/OPERATIONS_RUNBOOK.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Create infra/deploy/vercel.md and infra/deploy/coolify.md documenting Firmcode hybrid deployment. Vercel hosts the Next.js dashboard. Coolify hosts Docker containers for the NestJS API and Python worker. Cover Redis or managed Redis, NeonDB, build contexts, Dockerfile paths, exposed ports, health checks, environment variables, CORS origins, migration command, deployment order, rollback notes, and worker scaling. Explain how local Docker Compose maps to Vercel and Coolify services. Acceptance criteria are in docs/TASKS.md Task 0.2a.
```

## Task 1.1: GitHub App Configuration

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/ENVIRONMENT.md, docs/PRD.md, docs/AUTHORIZATION.md, docs/WEBHOOK_IDEMPOTENCY.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Implement typed GitHub App configuration in apps/api. Validate GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET, GITHUB_CLIENT_ID, and GITHUB_CLIENT_SECRET. Support escaped newline and base64 private key formats. Ensure config values are never logged. Add unit tests for validation and key normalization. Acceptance criteria are in docs/TASKS.md Task 1.1.
```

## Task 1.2: Webhook Signature Verification

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/WEBHOOK_IDEMPOTENCY.md, docs/ENVIRONMENT.md, docs/PRIVACY_RETENTION.md, docs/AUTHORIZATION.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Implement POST /webhooks/github in the NestJS API with raw-body HMAC SHA-256 signature verification using X-Hub-Signature-256. Parse payload only after verification. Accept supported events and return 202 for unsupported events. Add fixture-based tests for valid signatures, invalid signatures, missing signatures, supported events, and unsupported events. Acceptance criteria are in docs/TASKS.md Task 1.2.
```

## Task 1.3: Pull Request Event Normalization

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/WEBHOOK_IDEMPOTENCY.md, docs/PRD.md, docs/AUTHORIZATION.md, docs/REFERENCE_ANALYSIS.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Normalize GitHub pull_request webhook events for opened, synchronize, reopened, and ready_for_review actions. Upsert installation, repository, and pull request records. Create one review_run per supported event and prevent duplicate jobs using the GitHub delivery ID. Ignore draft PRs unless configured. Add fixture tests for each event and idempotency tests. Acceptance criteria are in docs/TASKS.md Task 1.3.
```

## Task 1.4: Webhook Idempotency And Superseded Runs

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/WEBHOOK_IDEMPOTENCY.md, docs/PRD.md, docs/OPERATIONS_RUNBOOK.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Implement delivery storage, duplicate detection, event ordering, and superseded-run protection from docs/WEBHOOK_IDEMPOTENCY.md. Persist GitHub delivery IDs and processing status, return 202 for duplicate deliveries without enqueueing duplicate jobs, supersede older review runs for previous head SHAs where safe, and verify the current PR head SHA before publishing. Add duplicate delivery, old-run publishing prevention, and same-PR-new-head-SHA tests. Acceptance criteria are in docs/TASKS.md Task 1.4.
```

## Task 2.1: GitHub PR File Fetcher

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/REFERENCE_ANALYSIS.md, docs/LARGE_PR_HANDLING.md, docs/PRIVACY_RETENTION.md, docs/PRD.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Build a GitHub adapter that fetches PR files with pagination, patch text, additions, deletions, status, and file contents at head_sha. Skip deleted, binary, unsupported, and oversized files while recording the reason. Add retry behavior for transient GitHub failures. Include tests with mocked pagination and edge cases. Acceptance criteria are in docs/TASKS.md Task 2.1.
```

## Task 2.2: Unified Diff Parser

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/REFERENCE_ANALYSIS.md, docs/LARGE_PR_HANDLING.md, docs/PRD.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Implement a unified diff parser that converts GitHub patch text into file hunks, old/new line mappings, and changed new-side lines. Expose a helper that determines whether a finding can be posted as an inline GitHub comment. Add golden fixture tests for additions, deletions, renames, multi-hunk diffs, and no-newline markers. Acceptance criteria are in docs/TASKS.md Task 2.2.
```

## Task 2.3: Risk Classification

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/LARGE_PR_HANDLING.md, docs/REFERENCE_ANALYSIS.md, docs/LLM_STRATEGY.md, docs/PRD.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Implement changed-file risk classification. Detect auth/security paths, secrets-like changes, database migrations, dependency files, public API changes, infrastructure files, and CI workflow changes. Persist risk flags and include them in the review context contract. Add unit tests for path and content classifiers plus a mixed PR fixture test. Acceptance criteria are in docs/TASKS.md Task 2.3.
```

## Task 2.4: Large PR And Generated File Handling

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/LARGE_PR_HANDLING.md, docs/LLM_STRATEGY.md, docs/PRIVACY_RETENTION.md, docs/REFERENCE_ANALYSIS.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Implement large-PR thresholds, generated/vendor skip rules, prioritized mode, summary-only mode, and skipped-file reporting from docs/LARGE_PR_HANDLING.md. Trigger large-PR mode from configurable file, diff, line, token, or runtime thresholds. Skip or summarize generated/vendor/minified/binary files with explicit reasons. Prioritize high-risk files when budget is constrained and persist skipped reasons in review run artifacts. Add huge diff, many-files, lockfile/generated/minified, and large-PR-with-Semgrep-finding tests. Acceptance criteria are in docs/TASKS.md Task 2.4.
```

## Task 3.1: Database Migrations

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/PRD.md, docs/AUTHORIZATION.md, docs/WEBHOOK_IDEMPOTENCY.md, docs/PRIVACY_RETENTION.md, docs/ENVIRONMENT.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Create database migrations for github_installations, repositories, pull_requests, review_runs, changed_files, analysis_artifacts, findings, and published_comments as described in docs/PRD.md. Add foreign keys, unique constraints for idempotency, and useful indexes for dashboard queries. Add migration smoke tests and repository upsert integration tests. Acceptance criteria are in docs/TASKS.md Task 3.1.
```

## Task 3.2: BullMQ Review Queue

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/PRD.md, docs/DEPLOYMENT.md, docs/OPERATIONS_RUNBOOK.md, docs/WEBHOOK_IDEMPOTENCY.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Add BullMQ review queue integration. The API should enqueue review.pull_request jobs after creating review runs. The worker should consume jobs, update status to running/succeeded/failed, apply retry policy, and persist error code/message on failure. Add integration tests from webhook fixture to queued job and worker lifecycle tests. Acceptance criteria are in docs/TASKS.md Task 3.2.
```

## Task 3.3: Worker Contract Schema

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/PRD.md, docs/LLM_STRATEGY.md, docs/REFERENCE_ANALYSIS.md, docs/PRIVACY_RETENTION.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Define versioned JSON contracts for review job input, diff artifacts, Semgrep findings, Tree-sitter artifacts, LLM output, and publish payloads. Put shared TypeScript schemas in packages/shared and matching Python models in apps/worker. Add validation tests and compatibility fixtures. Acceptance criteria are in docs/TASKS.md Task 3.3.
```

## Task 4.1: Semgrep Process Wrapper

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/REFERENCE_ANALYSIS.md, docs/LARGE_PR_HANDLING.md, docs/OPERATIONS_RUNBOOK.md, docs/ENVIRONMENT.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Implement a Python worker Semgrep wrapper that runs semgrep scan with JSON output, configurable timeout, stderr capture, exit code handling, and duration metrics. Normalize results into the shared finding schema and store raw output as an artifact. Add unit tests for JSON normalization and a process wrapper test against a small fixture file. Acceptance criteria are in docs/TASKS.md Task 4.1.
```

## Task 4.2: Changed-File Scan Workspace

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/REFERENCE_ANALYSIS.md, docs/LARGE_PR_HANDLING.md, docs/PRIVACY_RETENTION.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Create an isolated temporary workspace for Semgrep changed-file scans. Preserve repository-relative paths, exclude deleted and unsupported files, prevent path traversal, and clean up on success and failure. Add tests for workspace creation, cleanup, and path traversal rejection. Acceptance criteria are in docs/TASKS.md Task 4.2.
```

## Task 4.3: Infrastructure Rules

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/REFERENCE_ANALYSIS.md, docs/PRD.md, docs/LARGE_PR_HANDLING.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Add local Semgrep infrastructure rules for Terraform, Kubernetes YAML, Dockerfiles, and GitHub Actions. Cover privileged containers, unpinned actions, Docker root user, broad IAM permissions, and missing resource limits. Add positive and negative fixtures and a command to run the rule tests locally. Acceptance criteria are in docs/TASKS.md Task 4.3.
```

## Task 5.1: Parser Registry

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/REFERENCE_ANALYSIS.md, docs/LARGE_PR_HANDLING.md, docs/ENVIRONMENT.md, docs/OPERATIONS_RUNBOOK.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Implement the Python Tree-sitter language resolver and parser registry for JavaScript, TypeScript, Python, Go, Java, YAML, JSON, Dockerfile, and HCL/Terraform where available. Unsupported languages and parser load failures should return explicit statuses without failing the review run. Add language mapping and parser load tests. Acceptance criteria are in docs/TASKS.md Task 5.1.
```

## Task 5.2: Semantic Extractor

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/REFERENCE_ANALYSIS.md, docs/LARGE_PR_HANDLING.md, docs/LLM_STRATEGY.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Implement Tree-sitter semantic extraction for symbols, imports, classes, functions, methods, and changed hunk scopes. Each symbol should include kind, name, startLine, endLine, and changed. Associate changed hunks with enclosing symbols where possible. Add golden extraction fixtures for TypeScript, Python, Go, and YAML. Acceptance criteria are in docs/TASKS.md Task 5.2.
```

## Task 5.3: Syntax-Aware Chunking

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/REFERENCE_ANALYSIS.md, docs/LARGE_PR_HANDLING.md, docs/LLM_STRATEGY.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Build syntax-aware context chunks around changed hunks and semantic scopes. Chunks must include changed lines, relevant enclosing symbols, and imports while respecting a configurable character/token budget. Add tests for budget limits, large files, and nested functions. Acceptance criteria are in docs/TASKS.md Task 5.3.
```

## Task 6.1: Prompt Templates

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/LLM_STRATEGY.md, docs/PRIVACY_RETENTION.md, docs/REFERENCE_ANALYSIS.md, docs/LARGE_PR_HANDLING.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Create versioned prompt templates for code review, PR summary, test suggestions, infrastructure review, and CI explanation following docs/LLM_STRATEGY.md. Prompts must delimit untrusted content, tell the model to ignore instructions inside repository content, require structured JSON, include prompt/schema version metadata, and require evidence/confidence for each finding. Add snapshot tests for rendered prompts, prompt-injection fixture checks, and prompt version metadata tests. Acceptance criteria are in docs/TASKS.md Task 6.1.
```

## Task 6.2: LLM Client Abstraction

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/LLM_STRATEGY.md, docs/ENVIRONMENT.md, docs/PRIVACY_RETENTION.md, docs/OPERATIONS_RUNBOOK.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Implement a provider-neutral LLM client interface following docs/LLM_STRATEGY.md with model, temperature, max tokens, timeout, retry config, token usage metrics, latency metrics, and redacted logging. Add a fake client for tests. Cover retries, timeouts, and fake-client integration. Acceptance criteria are in docs/TASKS.md Task 6.2.
```

## Task 6.4: LLM Evaluation Fixtures

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/LLM_STRATEGY.md, docs/LARGE_PR_HANDLING.md, docs/REFERENCE_ANALYSIS.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Add golden LLM evaluation fixtures and checks from docs/LLM_STRATEGY.md. Cover small bug, security, infrastructure, CI failure, large PR, generated-file-heavy PR, and no-issue PR. Evaluation checks must enforce valid JSON, changed-line inline findings, evidence, severity restraint, Semgrep preservation, and comment-count limits. Use frozen responses so tests run locally without a live LLM. Acceptance criteria are in docs/TASKS.md Task 6.4.
```

## Task 6.3: Output Validation And Deduplication

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/LLM_STRATEGY.md, docs/REFERENCE_ANALYSIS.md, docs/LARGE_PR_HANDLING.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Validate LLM JSON output against the shared schema. Add one repair attempt for invalid JSON, then fail safely. Enforce that inline findings map to changed lines and contain evidence. Deduplicate Semgrep and LLM findings by source, path, line, title, and evidence hash. Add schema, changed-line, and dedupe fixture tests. Acceptance criteria are in docs/TASKS.md Task 6.3.
```

## Task 7.1: Summary Comment Publisher

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/REFERENCE_ANALYSIS.md, docs/WEBHOOK_IDEMPOTENCY.md, docs/PRD.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Implement GitHub summary comment publishing. Use a stable Firmcode marker so reruns update the previous summary rather than creating duplicates. Render risk, changed components, key findings, suggested tests, and CI explanation if present. Add mocked GitHub create/update tests and Markdown snapshot tests. Acceptance criteria are in docs/TASKS.md Task 7.1.
```

## Task 7.2: Inline Review Publisher

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/REFERENCE_ANALYSIS.md, docs/WEBHOOK_IDEMPOTENCY.md, docs/LARGE_PR_HANDLING.md, docs/LLM_STRATEGY.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Implement inline review publishing through the GitHub Reviews API. Only post comments on changed lines. Include severity, evidence, and actionable fix. Enforce max inline comment cap with severity/confidence ordering. Persist published comment IDs. Add review payload formatting tests and cap-ordering tests. Acceptance criteria are in docs/TASKS.md Task 7.2.
```

## Task 7.3: Dry Run Mode

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/PRD.md, docs/DASHBOARD_DESIGN.md, docs/DEPLOYMENT.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Add dry run mode for analysis without GitHub write calls. Dry run should persist would-be summary and inline comments, log clearly, and expose outputs through the dashboard API. Add publisher tests proving no GitHub write calls happen in dry run. Acceptance criteria are in docs/TASKS.md Task 7.3.
```

## Task 8.1: Check Run And Workflow Run Fetching

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/PRIVACY_RETENTION.md, docs/LLM_STRATEGY.md, docs/REFERENCE_ANALYSIS.md, docs/OPERATIONS_RUNBOOK.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Implement fetching of failed GitHub check runs and workflow logs for a PR head SHA. Handle missing permissions and unavailable logs gracefully. Truncate and redact logs before storage or LLM use. Add mocked GitHub tests plus log truncation and redaction tests. Acceptance criteria are in docs/TASKS.md Task 8.1.
```

## Task 8.2: CI Failure Explanation

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/LLM_STRATEGY.md, docs/PRIVACY_RETENTION.md, docs/DASHBOARD_DESIGN.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Generate CI failure explanations from normalized check run and log context. Group failures by job and step, summarize likely root cause, suggest fixes, and detect common flaky test signals. Add golden CI log fixtures and flaky classifier tests. Acceptance criteria are in docs/TASKS.md Task 8.2.
```

## Task 9.0: Complete Clerk Authentication Foundation

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.0, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/LOCAL_DEVELOPMENT.md, docs/DASHBOARD_DESIGN.md, docs/ADR.md ADR-012.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Clerk provider boundary, dashboard shell, dashboard data loaders, dashboard API proxy, Next.js route handlers, API controllers, dashboard auth store, settings/billing/GitHub modules, package manifests, config validation, and tests.
Implement the complete Clerk authentication foundation. Install and wire @clerk/nextjs in apps/web, add sign-in and sign-up pages using the dedicated auth-page design in docs/DASHBOARD_DESIGN.md, protect dashboard pages and route handlers with Clerk middleware, render Clerk UserButton and OrganizationSwitcher where enabled, derive the active workspace from Clerk state, and send Clerk bearer tokens from web route handlers/server code to the API. Add a public root holding page at /. Add a protected /auth/redirect post-auth route that resolves the verified workspace role through the existing dashboard API context, redirects Admin/owner-equivalent users to /dashboard/admin, redirects Developer/member-equivalent users to /dashboard/developer, and falls back safely without leaving authenticated users stuck on /sign-in. Add explicit /dashboard/admin and /dashboard/developer dashboard entry routes that reuse existing role-gated dashboard surfaces. Install a Clerk server verification package in apps/api, add a shared Nest auth guard/request context, resolve Clerk user/org claims to Firmcode workspace membership and role, and reject missing/invalid tokens plus spoofed user headers. Remove FIRMCODE_DASHBOARD_* from production auth flow and keep it only for explicit test/local bypass fixtures. Add web, API, and integration tests proving route protection, auth-page rendering/responsiveness, token verification, workspace resolution, role context, post-auth role redirects, route readiness, and spoofed-header rejection. Acceptance criteria are in docs/TASKS.md Task 9.0.
```

## Task 9.1: Repository And Run Views

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md, docs/DEPLOYMENT.md, docs/PRD.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Build the Next.js TypeScript/Tailwind dashboard repository list, review run list, and review run detail pages following docs/DASHBOARD_DESIGN.md. Show repository enabled status, last review, run filters, files, findings, artifacts, logs, and published comments. Pages must be Clerk-authenticated and use shared typed DTOs. Add component tests for loading, empty, error, and populated states, API integration tests, and desktop/mobile visual smoke checks. Acceptance criteria are in docs/TASKS.md Task 9.1.
```

## Task 9.2: Retry And Configuration Controls

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/DASHBOARD_DESIGN.md, docs/AUTHORIZATION.md, docs/PRD.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Add dashboard controls to retry failed runs and enable/disable repository automation. Persist repository configuration, prevent duplicate retry clicks, and show clear success/error states. Add UI interaction tests and API validation tests. Acceptance criteria are in docs/TASKS.md Task 9.2.
```

## Task 9.3: Overview, Findings, Settings, And Billing Shell

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Build the dashboard overview, findings inbox, settings shell, and billing shell following docs/DASHBOARD_DESIGN.md. Overview should include review activity, security findings, CI failures, repositories monitored, recent review runs, and needs-attention panel. Findings must support the planned filters. Settings must include General, GitHub App, Members, API Keys, Data Retention, and Notifications tabs. Billing should display plan/usage placeholders and link to Clerk Billing subscription management. Add component tests, Clerk-gated access tests, and visual smoke checks. Acceptance criteria are in docs/TASKS.md Task 9.3.
```

## Task 9.4: App Authorization In Dashboard APIs

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/PRIVACY_RETENTION.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Implement Clerk-backed app authorization rules from docs/AUTHORIZATION.md using the shared auth guard/request context from Task 9.0. Every dashboard API must verify a Clerk token, resolve workspace membership, check resource ownership, and enforce the simplified Admin/Developer role model. Require Admin for billing, member access, retention, API keys, global workspace policies, and support/safety controls. Allow Developers to connect GitHub, add/sync repositories, enable automation, run/retry reviews, trigger scans, and track report analysis where plan limits allow. Role-gate raw artifact access, tenant-scope all list endpoints, reject spoofed user headers, and persist audit events for sensitive actions. Add API authorization tests for every dashboard resource type, role capability tests, tenant-scoped list tests, spoofed-header rejection tests, audit-event tests, and cross-workspace access denial tests. Acceptance criteria are in docs/TASKS.md Task 9.4.
```

## Task 9.5: GitHub App Setup And Repository Sync Dashboard Flow

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.5, docs/PRD.md, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/WEBHOOK_IDEMPOTENCY.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current GitHub App configuration, dashboard shell/topbar/sidebar, repository list actions, settings GitHub App tab, dashboard API clients, API GitHub modules, installation persistence, repository sync code, authorization helpers, and tests.
Implement the GitHub OAuth account connection plus GitHub App install/status/sync dashboard flow so Connect GitHub and Sync GitHub are real product actions. This task depends on the complete Clerk auth foundation: OAuth start/callback routes must require a signed-in Clerk user and resolved workspace membership, and API identity must come from verified Clerk claims. Every signed-in Firmcode user must connect a GitHub OAuth account before using GitHub-backed dashboard workflows; OAuth identifies the user and supports membership/audit UX, while review, sync, and PR publishing must continue to use GitHub App installation tokens. Add a Clerk-authenticated /github/installations route or page and a PR Review workspace pattern that combines provider tabs, required GitHub OAuth account status, GitHub App installation status, repository readiness, enabled state, configure actions, and run/retry actions. Add OAuth callback/status handling, installation callback/status handling, workspace-scoped installation listing, installation repository sync, repository-level sync, and complete loading/success/error/disabled UI states. Ensure no route or button points to a missing page. Add API, component, and route/navigation tests for OAuth missing/connected states, installation listing, installation sync, repository sync, ownership denial, role denial, connected and unconnected states, and no-404 navigation. Acceptance criteria are in docs/TASKS.md Task 9.5.
```

## Task 9.6: Repository Detail And Rules/Policies Dashboard Pages

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.6, docs/PRD.md, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md, docs/PRIVACY_RETENTION.md, docs/LARGE_PR_HANDLING.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect existing repository list/detail routes, review run and finding APIs, repository configuration APIs, authorization policies, sidebar links, repository row actions, rules/policy data models, dashboard components, and tests.
Build the repository detail/configuration page and Rules / Policies page referenced by dashboard navigation. /repositories/:id must include Overview, Pull Requests, Findings, Configuration, and Activity tabs with ownership checks and role-aware configuration controls. /rules must cover review preferences, comment policy, prompt instructions, ignored paths, Semgrep/analysis toggles, and infrastructure/security policies. Developers can manage repository-level review settings; Admin is required for global workspace, retention, API key, billing, and support/safety settings. Add API tests, component tests, Developer/Admin role tests, cross-workspace denial tests, and navigation tests proving repository Configure and Rules / Policies destinations do not 404. Acceptance criteria are in docs/TASKS.md Task 9.6.
```

## Task 9.7: Pull Requests And CI Failures Dashboard Pages

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.7, docs/PRD.md, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md, docs/LLM_STRATEGY.md, docs/PRIVACY_RETENTION.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect current pull request persistence, review run APIs, findings APIs, CI failure explanation artifacts, overview needs-attention links, sidebar navigation, dashboard data fixtures, API filters, authorization helpers, and tests.
Build the Pull Requests and CI Failures dashboard pages. /pull-requests must provide a filterable PR queue and PR detail/history view. /ci-failures must provide failed workflow/job queue and detail views with root cause summaries, suggested fixes, related review runs, and collapsed redacted log excerpts. APIs must enforce workspace membership, resource ownership, and safe malformed-filter handling. Add API tests, component tests for loading/empty/error/populated and responsive states, and navigation tests proving Pull Requests and CI Failures routes do not 404 once enabled. Acceptance criteria are in docs/TASKS.md Task 9.7.
```

## Task 9.8: Dashboard Navigation Readiness And No-Dead-Link QA

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.8, docs/PRD.md, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the dashboard route tree, sidebar/topbar navigation definitions, overview needs-attention links, repository row actions, settings and billing actions, route tests, component tests, and visual smoke tooling.
Audit dashboard navigation and primary actions so implemented destinations are active, planned destinations are disabled, and no dashboard control leads to a 404. Add route manifest or component tests that fail when an active internal dashboard link points to an unimplemented route. Add regression coverage for disabled planned actions and run or document a browser smoke test across Overview, Repositories, Review Runs, Findings, Settings, Billing, and any newly enabled pages. Acceptance criteria are in docs/TASKS.md Task 9.8.
```

## Task 10.1: Observability

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/OPERATIONS_RUNBOOK.md, docs/DEPLOYMENT.md, docs/PRIVACY_RETENTION.md, docs/RELEASE_CHECKLIST.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Add structured logs, metrics, correlation IDs, and stage duration tracking across webhooks, queue jobs, worker stages, and GitHub publishing. Health/readiness checks should cover database and Redis. Add logger context tests and readiness integration tests. Acceptance criteria are in docs/TASKS.md Task 10.1.
```

## Task 10.2: Security Hardening

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/PRIVACY_RETENTION.md, docs/AUTHORIZATION.md, docs/OPERATIONS_RUNBOOK.md, docs/ENVIRONMENT.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Harden webhook rate limits, secret redaction, artifact retention, repository allowlist, and input validation following docs/PRIVACY_RETENTION.md. Ensure secrets never appear in logs or persisted artifacts, raw artifacts are retention-bound, and deletion behavior is defined. Add tests for rate limits, redaction, retention config, cleanup, and allowlist behavior. Acceptance criteria are in docs/TASKS.md Task 10.2.
```

## Task 10.3: End-To-End Review Fixture

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/LOCAL_DEVELOPMENT.md, docs/RELEASE_CHECKLIST.md, docs/LLM_STRATEGY.md, docs/LARGE_PR_HANDLING.md, docs/DEPLOYMENT.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Create a synthetic end-to-end dry-run PR review fixture. It should run from webhook fixture to generated summary, inline comments, findings, and artifacts without posting to GitHub. Include application code, infrastructure code, a Semgrep finding, and a CI failure. Add one command to run it locally and a smoke test suitable for CI. Acceptance criteria are in docs/TASKS.md Task 10.3.
```

## Task 10.4: Operations Runbook And Release Checklist

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/OPERATIONS_RUNBOOK.md, docs/RELEASE_CHECKLIST.md, docs/DEPLOYMENT.md, docs/LOCAL_DEVELOPMENT.md, docs/ENVIRONMENT.md.
Acceptance/test criteria: Follow the acceptance criteria and tests for this task in docs/TASKS.md; add or update automated tests and do not declare the task done until those checks pass or any inability to run them is documented.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing app code, package scripts, configs, tests, adjacent modules, and relevant reference code, then follow the discovered implementation patterns instead of guessing or inventing a parallel style.
Finalize operational readiness using docs/OPERATIONS_RUNBOOK.md and docs/RELEASE_CHECKLIST.md. Ensure the runbook covers failed jobs, GitHub rate limits, webhook failures, Semgrep timeouts, Tree-sitter failures, LLM failures, publishing failures, NeonDB issues, and Redis backlog. Make the release checklist executable for local or staging release. Add readiness checks for database and Redis and a release smoke test using the synthetic dry-run fixture. Acceptance criteria are in docs/TASKS.md Task 10.4.
```
