# Task 3.1 Database Migrations

## Planning Docs Read

- `AGENTS.md`
- `docs/PRD.md`
- `docs/AUTHORIZATION.md`
- `docs/WEBHOOK_IDEMPOTENCY.md`
- `docs/PRIVACY_RETENTION.md`
- `docs/ENVIRONMENT.md`
- `docs/TASKS.md`
- `docs/REFERENCE_ANALYSIS.md`

## Reference Files Read

- `pr-agent/pr_agent/tools/pr_reviewer.py`
- `semgrep/cli/src/semgrep/rule_match.py`

No reference repository source was imported, copied, or modified. The schema adapts the reference lessons around persistent review state, stable finding identity, and durable artifacts into Firmcode-owned migrations and tests.

## Implementation Notes

- Added the initial PostgreSQL migration for GitHub installations, repositories, pull requests, review runs, changed files, analysis artifacts, findings, and published comments.
- Added `github_deliveries` alongside the PRD tables because webhook idempotency requires a durable unique delivery key before queueing review work.
- Added foreign keys, uniqueness constraints for webhook/run/file/finding/comment idempotency, and indexes for repository, run, finding, artifact, and delivery dashboard queries.
- Added a small migration runner and `npm run db:migrate` command.
- Added a Postgres-backed GitHub webhook persistence adapter for installation, repository, PR, delivery, and review-run state.

## Verification

- `npm run test --workspace @firmcode/api`
- `npm run lint --workspace @firmcode/api`
- `npm run build --workspace @firmcode/api`
