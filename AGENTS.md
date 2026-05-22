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

## Definition Of Done

A task is not done until:

- Code is implemented behind the intended module boundary.
- Unit or integration tests cover the expected behavior and at least one failure path.
- Environment variables are documented.
- Logs and errors are structured enough for debugging.
- The task can be run locally through Docker Compose or a documented command.
- No secrets are committed.
- Documentation is updated when behavior, setup, or architecture changes.
