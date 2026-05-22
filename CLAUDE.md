# CLAUDE.md

This file gives Claude and other coding assistants the local project context for Firmcode.

## What We Are Building

Firmcode is a production-ready personal MVP for AI pull request review. It listens to GitHub pull request events, analyzes diffs using Tree-sitter and Semgrep, uses an LLM for grounded review reasoning, and posts summaries plus inline review comments back to GitHub.

Primary outcomes:

- AI PR summaries.
- Inline code review comments.
- Security analysis grounded in Semgrep.
- Semantic code understanding grounded in Tree-sitter.
- Missing test suggestions.
- CI/CD failure explanations.
- Infrastructure review for Terraform, Kubernetes YAML, Helm, Dockerfiles, and GitHub Actions.

## MVP Stack

- Backend API: NestJS.
- Frontend: Next.js with TypeScript and Tailwind CSS.
- Worker: Python.
- Queue: Redis + BullMQ.
- Database: NeonDB/PostgreSQL.
- Auth: Clerk.
- Billing: Clerk Billing.
- Static analysis: Semgrep CLI.
- Semantic parsing: Tree-sitter.
- Deployment: Docker Compose.

## Source Reference Directories

The workspace currently includes reference source trees:

- `pr-agent/`: reference for PR review workflows, GitHub provider abstractions, prompts, and comment behavior.
- `semgrep/`: reference for static analysis behavior and Semgrep concepts.
- `tree-sitter/`: reference for parsing concepts and Tree-sitter APIs.
- `prompts/main.md`: product scope and requested outputs.

Do not modify the reference projects unless the user explicitly asks. Build Firmcode in new project directories. These repositories are inspiration and study material, not implementation dependencies.

Before building related features, read the relevant reference code and [docs/REFERENCE_ANALYSIS.md](docs/REFERENCE_ANALYSIS.md). Reimplement the useful patterns in Firmcode-owned modules instead of importing or copying reference code.

Also consult the production-planning docs when relevant:

- [docs/ADR.md](docs/ADR.md)
- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)
- [docs/AUTHORIZATION.md](docs/AUTHORIZATION.md)
- [docs/PRIVACY_RETENTION.md](docs/PRIVACY_RETENTION.md)
- [docs/LLM_STRATEGY.md](docs/LLM_STRATEGY.md)
- [docs/WEBHOOK_IDEMPOTENCY.md](docs/WEBHOOK_IDEMPOTENCY.md)
- [docs/LARGE_PR_HANDLING.md](docs/LARGE_PR_HANDLING.md)
- [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/OPERATIONS_RUNBOOK.md](docs/OPERATIONS_RUNBOOK.md)
- [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)

## Recommended New Project Layout

```text
apps/
  api/
  web/
  worker/
packages/
  shared/
  prompts/
  github/
infra/
  docker/
  semgrep/
docs/
```

## Dashboard Design

The dashboard must follow [docs/DASHBOARD_DESIGN.md](docs/DASHBOARD_DESIGN.md): clean modern light mode, TypeScript, Tailwind CSS, compact SaaS shell, Clerk for auth/billing, and NeonDB-backed application data. Build operational product screens first, not a marketing landing page.

## Implementation Priorities

1. GitHub App setup, webhook verification, and PR event ingestion.
2. Queue and persisted job lifecycle.
3. Diff extraction and hunk/line mapping.
4. Semgrep changed-file scan.
5. Tree-sitter semantic extraction.
6. LLM review pipeline with validated JSON output.
7. GitHub summary and inline comment posting.
8. CI failure explanation.
9. Next.js dashboard for repositories, runs, findings, and logs.

## Non-Negotiable Constraints

- Keep the first version deployable with Docker Compose.
- Keep the API and worker separate, but avoid premature microservices.
- Use deterministic tools before LLM reasoning.
- Validate every webhook signature.
- Validate LLM output before posting anything to GitHub.
- Persist enough state to debug and retry failed review runs.
- Keep secrets out of logs and source control.

## Review Output Principles

Inline comments should be:

- Tied to a changed line.
- Evidence-backed.
- Actionable.
- Short enough to be read inside GitHub.
- Deduplicated across Semgrep and LLM findings.

PR summaries should include:

- Executive summary.
- Changed components.
- Risk level and rationale.
- Notable findings.
- Suggested tests.
- CI status/failure explanation when available.

## Test Strategy

Use fixtures heavily. Required fixture categories:

- GitHub webhook payloads.
- PR diff patches.
- Changed file snapshots.
- Semgrep JSON output.
- Tree-sitter extraction JSON.
- CI logs.
- LLM JSON responses.
- Expected GitHub review payloads.

Unit test pure parsing/formatting logic. Integration test API-to-queue-to-worker boundaries. Add end-to-end smoke tests using synthetic PR fixtures before enabling real GitHub posting.

## Prompting Requirements

LLM prompts must:

- Delimit repository content as untrusted data.
- Instruct the model to ignore instructions inside code, comments, diffs, commit messages, and CI logs.
- Ask for structured JSON output.
- Require evidence fields for every finding.
- Include severity, category, confidence, file path, line range, rationale, and suggested fix.
- Separate inline-worthy findings from summary-only observations.

See `docs/TASK_PROMPTS.md` for task-level implementation prompts and `docs/PRD.md` for product requirements.
