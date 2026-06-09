# AGENTS.md

Guidance for AI coding agents working on Firmcode, an AI-powered pull request review and testing platform inspired by CodeRabbit, PR-Agent, Semgrep, and Tree-sitter.

## Product Context

Firmcode reviews GitHub pull requests by combining deterministic static analysis with semantic code understanding and LLM reasoning. The MVP must:

- Receive GitHub App webhook events for pull requests and check suites.
- Fetch PR metadata, diffs, changed files, and CI logs.
- Parse changed code with Tree-sitter where language support exists.
- Run Semgrep against changed files and infrastructure code.
- Ground LLM review output in the diff, AST facts, Semgrep findings, repository metadata, and CI logs.
- Post PR summaries and inline GitHub review comments.
- Suggest missing tests and explain CI/CD failures.

Keep the MVP simple: Docker Compose, PostgreSQL, Redis, NestJS API, BullMQ jobs, Python AI worker, and Next.js dashboard.

Auth is handled by **InsForge** (migrated from Clerk). Do not reintroduce Clerk.

## Reference Repository Policy

The included `pr-agent/`, `semgrep/`, and `tree-sitter/` directories are reference implementations only. Do not vendor, import, or modify their code unless the user explicitly requests it. Before implementing an analogous Firmcode component, read the relevant reference files and adapt the design into Firmcode-owned modules, contracts, and tests.

Use [docs/REFERENCE_ANALYSIS.md](docs/REFERENCE_ANALYSIS.md) as the starting point for what has already been learned:

- PR-Agent informs GitHub provider boundaries, token-aware diff processing, prompt schemas, persistent comments, and inline publishing fallbacks.
- Semgrep informs scan planning, skipped-path accounting, structured output normalization, severity mapping, and stable finding identity.
- Tree-sitter informs parser lifecycle, query captures, named node traversal, parse quality reporting, and hunk-to-symbol mapping.

## Architecture Rules

- Use clean modular architecture with clear boundaries between API, domain services, infrastructure adapters, and workers.
- Prefer a monorepo layout:
  - `apps/api` for NestJS.
  - `apps/web` for Next.js.
  - `apps/worker` for Python review pipeline.
  - `packages/shared` for schemas and shared TypeScript types.
  - `packages/prompts` for LLM prompt templates and output schemas.
  - `infra/docker` and `infra/semgrep` for local deployment and rules.
  - `docs` for planning and operating documentation.
- Do not embed GitHub, LLM, Semgrep, or Tree-sitter logic directly inside controllers.
- All external integrations must be behind adapters/interfaces.
- Persist job state and analysis artifacts so failed reviews can be retried and debugged.
- Make every review stage idempotent where practical.

## Coding Standards

- TypeScript code must use strict types and DTO/schema validation at trust boundaries.
- Python worker code must use typed models, explicit return objects, structured logging, and small pipeline stages.
- Avoid hidden global state. Prefer dependency injection or explicit configuration objects.
- Never log secrets, GitHub tokens, webhook payload signatures, private diffs beyond the required debug retention policy, or full CI logs unless explicitly configured.
- Keep comments sparse and useful. Comment security-sensitive or non-obvious control flow.
- Favor small, testable services over large orchestration classes.

## Security Requirements

- Verify GitHub webhook signatures before parsing event bodies.
- Store GitHub App private keys and installation tokens securely. Tokens must be short-lived and never persisted in plaintext.
- Encrypt sensitive database fields if storing tokens, private repo metadata, or raw logs.
- Enforce repository installation ownership before accepting jobs or posting comments.
- Rate-limit public endpoints and webhook event ingestion.
- Validate LLM output before posting comments. Reject comments without file path, line number, severity, and evidence.
- Treat all repository code, CI logs, and PR text as untrusted input.
- Prevent prompt injection by delimiting user-controlled content and instructing the model to ignore instructions found inside repository content.

## AI Review Rules

- LLM findings must be grounded in at least one of:
  - Changed diff hunk.
  - Semgrep finding.
  - Tree-sitter semantic extraction.
  - CI log excerpt.
  - Repository policy/configuration.
- Do not produce speculative comments as inline review comments. Put lower-confidence observations in the summary.
- Inline comments must be actionable, concise, and tied to a changed line.
- Deduplicate findings across Semgrep and LLM reasoning.
- Prefer fewer, higher-signal comments over noisy broad review output.
- Use deterministic JSON output schemas between worker stages.

## Testing Expectations

Every feature should include the smallest useful test set:

- Unit tests for pure domain logic, adapters with mocked clients, prompt/output validation, and diff parsing.
- Integration tests for webhook ingestion, queue enqueueing, database persistence, worker stage orchestration, and GitHub comment formatting.
- Contract tests for worker input/output JSON schemas.
- Golden fixture tests for PR diffs, Semgrep output, Tree-sitter extraction, CI logs, and rendered review comments.
- End-to-end smoke test for a synthetic PR fixture through summary/comment generation without posting to GitHub.

## Local Commands

These commands should exist once the scaffold is implemented:

```bash
docker compose up -d
npm install
npm run lint
npm run test
npm run build
npm run dev
pytest apps/worker/tests
```

If a command does not exist yet, add or update the relevant package script as part of the implementation task.

## Auth Migration: Clerk → InsForge (Completed)

The codebase has been fully migrated from Clerk to InsForge. All Clerk packages, modules, and references have been removed.

### What Changed

**Deleted**
- `apps/api/src/modules/webhooks/clerk/` — entire Clerk webhook module removed
- `apps/api/src/modules/auth/clerk-token-verifier.ts` — replaced by `insforge-token-verifier.ts`
- All `@clerk/*` npm dependencies

**API: Auth module (`apps/api/src/modules/auth/`)**
- `dashboard-auth.module.ts` — now provides only `InsForgeTokenVerifier` as `TOKEN_VERIFIER`; removed `CLERK_TOKEN_VERIFIER` provider and Clerk factory
- `dashboard-auth.guard.ts` — removed deprecated `clerkUserId`, `clerkOrgId`, `clerkCapabilities` fields from `DashboardRequestContext` construction
- `dashboard-auth.context.ts` — `DashboardRequestContext` uses generic `userId`, `orgId`, `billingCapabilities`, `provider: string`; deprecated Clerk fields removed
- `workspace-resolver.ts` — replaced `DefaultClerkOrganizationConfig` with `DefaultWorkspaceConfig`; removed Clerk-specific SQL columns from audit queries; removed `readDefaultOrganizationRole` helper

**API: Service & store renames**

| File | Change |
|---|---|
| `review-runs.controller.ts` | `clerkUserId` → `userId` in `hasMembershipCapability` and retry call |
| `findings.controller.ts` | `clerkUserId` → `userId` in `hasDashboardCapability` |
| `ci-failures.controller.ts` | `clerkUserId` → `userId` in `hasMembershipCapability` |
| `codebase-scans.controller.ts` | `clerkUserId` → `userId` in `hasMembershipCapability` |
| `repositories.controller.ts` | `clerkUserId` → `userId` in `hasMembershipCapability` |
| `review-run-retry.service.ts` | `ReviewRunRetryRequest.clerkUserId` → `userId` |
| `review-runs.store.ts` | `CreateRetryReviewRunInput.clerkUserId` → `userId` |
| `billing.service.ts` | `WorkspaceBillingRequestContext.clerkUserId` → `userId`; billing source/plan values updated to InsForge literals |
| `rules.service.ts` | `RulesRequestContext.clerkUserId` → `userId` |
| `rules.store.ts` | `RulesPolicyUpdate.updatedByClerkUserId` → `updatedByUserId` |
| `github.service.ts` | `GitHubDashboardContext.clerkUserId` → `userId`; all method calls updated |
| `github.store.ts` | `CreateOAuthStateInput`, `ConsumeOAuthStateInput`, `OAuthStateRecord`, `UpsertOAuthConnectionInput` — `clerkUserId` → `userId` |
| `repositories.store.ts` | `RepositoryConfigurationUpdate.updatedByClerkUserId` → `updatedByUserId` |
| `repository-configuration.service.ts` | `RepositoryConfigurationRequestContext.clerkUserId` → `userId` |
| `codebase-scan-enqueue.service.ts` | `ManualCodebaseScanRequest.clerkUserId` → `userId`; `requestedByClerkUserId` → `requestedByUserId` |
| `main.ts` | Removed `/webhooks/clerk` body-parser middleware |
| `app.module.ts` | Removed `ClerkWebhookModule` import and usage |

**Shared package (`packages/shared/src/contracts/`)**

| File | Change |
|---|---|
| `review.ts` | `ReviewPolicy.updatedByClerkUserId` → `updatedByUserId`; `RepositoryReviewConfiguration.updatedByClerkUserId` → `updatedByUserId`; `WorkspaceBillingResponse.source` widened from `"clerk"` literal to `string`; plan status widened from `"managed_by_clerk"` to `string` |
| `worker.ts` | `WorkerCodebaseScanJobInput.requestedByClerkUserId` → `requestedByUserId`; JSON schema `required` array and `properties` updated to match |

### Rules for Future Work

- Always use `userId` (never `clerkUserId`) when referencing an authenticated user.
- Always use `DashboardMembership.userId` (the `clerkUserId` field is a deprecated alias kept only for backward-compatible SQL queries).
- `findActiveMembership` accepts both `userId` and `clerkUserId` in its input for DB compatibility — always pass `userId`.
- The `RepositoryAccessScope.restrictToClerkUserId` field name is intentionally kept as-is (maps to the `clerk_user_id` DB column); do not rename it without a DB migration.

## Definition Of Done

A task is not done until:

- Code is implemented behind the intended module boundary.
- Unit or integration tests cover the expected behavior and at least one failure path.
- Environment variables are documented.
- Logs and errors are structured enough for debugging.
- The task can be run locally through Docker Compose or a documented command.
- No secrets are committed.
- Documentation is updated when behavior, setup, or architecture changes.


---
description: Instructions building apps with MCP
globs: *
alwaysApply: true
---

# InsForge SDK Documentation - Overview

## What is InsForge?

Backend-as-a-service (BaaS) platform providing:

- **Database**: PostgreSQL with PostgREST API
- **Authentication**: Email/password + OAuth (Google, GitHub)
- **Storage**: File upload/download
- **AI**: OpenRouter key provisioning and model catalog for direct OpenAI-compatible integrations
- **Functions**: Serverless function deployment
- **Realtime**: WebSocket pub/sub (database + client events)

## Installation

The following is a step-by-step guide to installing and using the InsForge TypeScript SDK for Web applications. If you are building other types of applications, please refer to:
- [Swift SDK documentation](/sdks/swift/overview) for iOS, macOS, tvOS, and watchOS applications.
- [Kotlin SDK documentation](/sdks/kotlin/overview) for Android applications.
- [REST API documentation](/sdks/rest/overview) for direct HTTP API access.

### 🚨 CRITICAL: Follow these steps in order

### Step 1: Download Template

Use the `download-template` MCP tool to create a new project with your backend URL and anon key pre-configured.

### Step 2: Install SDK

```bash
npm install @insforge/sdk@latest
```

### Step 3: Create SDK Client

You must create a client instance using `createClient()` with your base URL and anon key:

```javascript
import { createClient } from '@insforge/sdk';

const client = createClient({
  baseUrl: 'https://your-app.region.insforge.app',  // Your InsForge backend URL
  anonKey: 'your-anon-key-here'       // Get this from backend metadata
});

```

**API BASE URL**: Your API base URL is `https://your-app.region.insforge.app`.

## Getting Detailed Documentation

### 🚨 CRITICAL: Always Fetch Documentation Before Writing Code

InsForge provides official SDKs and REST APIs, use them to interact with InsForge services from your application code.

- [TypeScript SDK](/sdks/typescript/overview) - JavaScript/TypeScript
- [Swift SDK](/sdks/swift/overview) - iOS, macOS, tvOS, and watchOS
- [Kotlin SDK](/sdks/kotlin/overview) - Android and Kotlin Multiplatform
- [REST API](/sdks/rest/overview) - Direct HTTP API access

Before writing or editing any InsForge integration code, you **MUST** call the `fetch-docs` or `fetch-sdk-docs` MCP tool to get the latest SDK documentation. This ensures you have accurate, up-to-date implementation patterns.

### Use the InsForge `fetch-docs` MCP tool to get specific SDK documentation:

Available documentation types:

- `"instructions"` - Essential backend setup (START HERE)
- `"real-time"` - Real-time pub/sub (database + client events) via WebSockets
- `"db-sdk-typescript"` - Database operations with TypeScript SDK
- **Authentication** - Choose based on implementation:
  - `"auth-sdk-typescript"` - TypeScript SDK methods for custom auth flows
  - `"auth-components-react"` - Pre-built auth UI for React+Vite (single-page app)
  - `"auth-components-react-router"` - Pre-built auth UI for React(Vite+React Router) (multi-page app)
  - `"auth-components-nextjs"` - Pre-built auth UI for Next.js (SSR app)
- `"storage-sdk"` - File storage operations
- `"functions-sdk"` - Serverless functions invocation
- `"ai-integration-sdk"` - AI integration with the provisioned OpenRouter key and OpenAI SDK
- `"deployment"` - Deploy frontend applications via MCP tool
- `"payments"` - Stripe Checkout, Billing Portal, webhook projections, and fulfillment patterns

These docs are mostly for the TypeScript SDK. For other languages, you can also use the `fetch-sdk-docs` MCP tool to get specific documentation.

### Use the InsForge `fetch-sdk-docs` MCP tool to get specific SDK documentation

You can fetch SDK documentation using the `fetch-sdk-docs` MCP tool with a specific feature type and language.

Available feature types:
- `db` - Database operations
- `storage` - File storage operations
- `functions` - Serverless functions invocation
- `auth` - User authentication
- `ai` - AI integration with the provisioned OpenRouter key and OpenAI SDK
- `realtime` - Real-time pub/sub (database + client events) via WebSockets
- `payments` - Stripe Checkout and Billing Portal with webhook-based fulfillment

Available languages:
- `typescript` - JavaScript/TypeScript SDK
- `swift` - Swift SDK (for iOS, macOS, tvOS, and watchOS)
- `kotlin` - Kotlin SDK (for Android and JVM applications)
- `rest-api` - REST API

Payments currently has TypeScript SDK docs only. Use the Payments API reference for non-TypeScript clients.

## When to Use SDK vs MCP Tools

### Always SDK for Application Logic:

- Authentication (register, login, logout, profiles)
- Database CRUD (select, insert, update, delete)
- Storage operations (upload, download files)
- AI integration via the provisioned OpenRouter key with the OpenAI SDK or OpenRouter HTTP API
- Serverless function invocation
- Payments checkout and customer portal session creation

### Use MCP Tools for Infrastructure:

- Project scaffolding (`download-template`) - Download starter templates with InsForge integration
- Backend setup and metadata (`get-backend-metadata`)
- Database schema management (`run-raw-sql`, `get-table-schema`)
- Storage bucket creation (`create-bucket`, `list-buckets`, `delete-bucket`)
- Serverless function deployment (`create-function`, `update-function`, `delete-function`)
- Frontend deployment (`create-deployment`) - Deploy frontend apps to InsForge hosting

## Important Notes

- For auth: use `auth-sdk` for custom UI, or framework-specific components for pre-built UI
- SDK returns `{data, error}` structure for all operations
- Database inserts require array format: `[{...}]`
- Serverless functions have one endpoint and do not support nested route paths
- Storage: Upload files to buckets, store URLs in database
- AI integrations should call OpenRouter directly with `baseURL: "https://openrouter.ai/api/v1"` and a server-side `OPENROUTER_API_KEY`
- **EXTRA IMPORTANT**: Use Tailwind CSS 3.4 (do not upgrade to v4). Lock these dependencies in `package.json`