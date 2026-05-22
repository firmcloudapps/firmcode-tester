# Task 0.1 Implementation Notes

## Planning Docs Read

- `AGENTS.md`
- `prompts/main.md`
- `docs/PRD.md`
- `docs/REFERENCE_ANALYSIS.md`
- `docs/ADR.md`
- `docs/ENVIRONMENT.md`
- `docs/AUTHORIZATION.md`
- `docs/PRIVACY_RETENTION.md`
- `docs/LLM_STRATEGY.md`
- `docs/WEBHOOK_IDEMPOTENCY.md`
- `docs/LARGE_PR_HANDLING.md`
- `docs/DASHBOARD_DESIGN.md`
- `docs/DEPLOYMENT.md`
- `CLAUDE.md`

## Reference Repository Notes

No reference repository source files were imported, copied, or modified. This scaffold task does not implement an analogous PR-Agent, Semgrep, or Tree-sitter component yet, so `docs/REFERENCE_ANALYSIS.md` was used as the reference baseline for boundaries and future package placement.

## Scaffold Choices

- Root npm workspaces own TypeScript packages and apps.
- `apps/api` starts as a NestJS app with a `/health` controller.
- `apps/web` starts as a Next.js TypeScript and Tailwind CSS dashboard shell.
- `apps/worker` starts as a Python package with a typed health helper and pytest setup.
- `packages/shared` exposes initial health and review contracts used by API and web.
- `packages/prompts` reserves versioned prompt metadata for later LLM stages.
- `infra/docker` is present for the Docker Compose work scheduled in Task 0.2.
