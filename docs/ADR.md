# Architecture Decision Records

This file captures current Firmcode architecture decisions. When a decision changes, add a new entry rather than silently rewriting history.

## ADR-001: Monorepo For MVP

Status: Accepted

Decision: Use a monorepo with `apps/api`, `apps/web`, `apps/worker`, `packages/shared`, `packages/prompts`, and `infra`.

Rationale:

- Keeps API, web, worker, shared contracts, and prompt templates easy to evolve together.
- Reduces coordination overhead for a personal MVP.
- Allows future service extraction without starting with premature microservices.

## ADR-002: NestJS API

Status: Accepted

Decision: Use NestJS for the HTTP API, webhook ingestion, dashboard APIs, queue producers, and integration boundary.

Rationale:

- Strong module structure.
- Good dependency injection and testing story.
- Natural fit for TypeScript DTOs and shared schemas.

## ADR-003: Python Worker

Status: Accepted

Decision: Use Python for the AI review worker.

Rationale:

- Best ecosystem fit for Semgrep CLI orchestration, Tree-sitter bindings, data processing, and LLM pipeline experimentation.
- Keeps long-running analysis work out of the HTTP API.

## ADR-004: BullMQ And Redis

Status: Accepted

Decision: Use Redis and BullMQ for review job orchestration.

Rationale:

- Works naturally with NestJS.
- Supports retries, backoff, delayed jobs, concurrency, and job observability.
- Sufficient for Docker Compose MVP.

## ADR-005: NeonDB/PostgreSQL

Status: Accepted

Decision: Use NeonDB as managed PostgreSQL for production-like deployments, while allowing local PostgreSQL in Docker Compose.

Rationale:

- PostgreSQL fits relational review state, job artifacts, findings, and dashboard queries.
- NeonDB reduces operational burden for managed environments.
- Local PostgreSQL keeps development reproducible.

## ADR-006: Clerk For Auth And Billing

Status: Accepted

Decision: Use Clerk for authentication, user/session management, organizations where enabled, and billing/subscription management.

Rationale:

- Avoids building auth and billing before the review product loop is proven.
- Keeps Firmcode focused on GitHub review automation and analysis.
- Firmcode still owns application authorization and GitHub installation mapping.

## ADR-007: Semgrep CLI Wrapper

Status: Accepted

Decision: Run Semgrep through a worker-owned CLI/process wrapper for MVP.

Rationale:

- Avoids integrating Semgrep internals directly.
- Preserves clean process isolation, timeouts, stderr capture, and JSON output normalization.
- Matches the reference-repo policy: study Semgrep patterns, do not vendor implementation code.

## ADR-008: Tree-sitter Adapter Layer

Status: Accepted

Decision: Use Tree-sitter through Firmcode-owned parser registry, query library, and semantic extraction adapters.

Rationale:

- Keeps language support incremental.
- Allows parser failures to be recorded per file without failing the full review.
- Makes symbol extraction testable with language fixtures.

## ADR-009: Schema-First LLM Pipeline

Status: Accepted

Decision: LLM prompts must request structured JSON validated against Firmcode-owned schemas before publishing.

Rationale:

- Reduces hallucinated or malformed GitHub comments.
- Enables deterministic output validation, repair attempts, deduplication, and dry-run inspection.

## ADR-010: Docker-First Local Development And Hybrid Deployment

Status: Accepted

Decision: Use Docker-first local development with Docker Compose. Deploy the Next.js dashboard to Vercel, and deploy the NestJS API plus Python worker as Docker containers on Coolify. Kubernetes is deferred.

Rationale:

- Catches Dockerfile, dependency, networking, environment, worker, and startup issues early.
- Uses Vercel where it is strongest: Next.js dashboard hosting, previews, and Clerk frontend integration.
- Uses Coolify where it is strongest: long-running API/worker containers, queues, Semgrep, Tree-sitter, and GitHub webhook handling.
- Keeps local development and personal MVP deployment simple.
- Avoids operational complexity before product behavior is stable.

Implications:

- API and worker need production-grade Dockerfiles for Coolify.
- Web can have a Dockerfile for local Compose and fallback deployment, but production web deploys to Vercel.
- Local Compose should run the full stack, including web, to catch integration issues.
- Health/readiness endpoints must work inside containers.
- Build, migration, worker startup, and Semgrep availability must be validated in containers.
- API CORS must explicitly allow Vercel production, Vercel preview, and local development origins.
- Local host-only development can exist for speed, but Docker Compose is the canonical integration path.
