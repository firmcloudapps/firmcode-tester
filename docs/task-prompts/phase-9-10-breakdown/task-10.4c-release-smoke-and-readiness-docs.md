# Task 10.4c: Release Smoke And Readiness Docs

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 10.4, docs/TASK_PROMPTS.md Task 10.4, docs/RELEASE_CHECKLIST.md, docs/OPERATIONS_RUNBOOK.md, docs/DEPLOYMENT.md, docs/LOCAL_DEVELOPMENT.md.
Code context requirement: Before implementing, inspect health/readiness endpoints, dry-run fixture command, Docker Compose, release checklist, operations runbook, deployment docs, and smoke test code.

Wire the release smoke path into operations documentation. The release docs should tell operators how to verify database and Redis readiness, how to run the synthetic dry-run fixture, how to confirm dashboard pages load, and how to decide whether to proceed, retry, rollback, or pause a release.

If health/readiness checks or the synthetic fixture command are missing, document the gap clearly and add explicit follow-up notes only when implementation is blocked by a separate task. Prefer linking to the concrete commands created by Tasks 10.1c and 10.3b/10.3c.

Testing requirements:
- Run or document the readiness integration test command.
- Run or document the release smoke test using the synthetic dry-run fixture.
- Add documentation checks if available.
- Verify docs do not reference stale endpoint paths, service names, or command names.

Acceptance criteria:
- Operations and release docs reference health/readiness checks for database and Redis.
- Dry-run release smoke test is documented with expected outputs.
- Release decision guidance includes proceed, retry, rollback, and pause cases.
- Referenced commands match the current repo.
- Readiness and release smoke tests pass, or inability to run them is documented with exact command and failure.
```
