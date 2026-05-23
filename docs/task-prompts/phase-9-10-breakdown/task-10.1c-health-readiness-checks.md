# Task 10.1c: Health And Readiness Checks

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 10.1, docs/TASK_PROMPTS.md Task 10.1, docs/OPERATIONS_RUNBOOK.md, docs/DEPLOYMENT.md, docs/RELEASE_CHECKLIST.md, docs/ENVIRONMENT.md.
Code context requirement: Before implementing, inspect existing health endpoints, Docker Compose health checks, API database and Redis clients, worker startup checks, deployment docs, and tests.

Add or complete health and readiness checks that cover database and Redis. Health should indicate the process is running. Readiness should verify required dependencies for serving dashboard/API traffic and processing jobs. Use typed responses with dependency names, status, and safe error summaries.

Update Docker Compose or deployment docs only where needed to point at the readiness endpoint. Keep checks fast, bounded by timeouts, and safe for repeated probing.

Testing requirements:
- Add readiness integration tests for healthy database and Redis dependencies.
- Add tests for database failure and Redis failure responses using mocks or test doubles.
- Add tests that health remains lightweight and does not require expensive external calls.
- Update or document a local command to exercise health/readiness.

Acceptance criteria:
- Health and readiness endpoints exist or are completed.
- Readiness covers database and Redis.
- Dependency failures return clear, safe statuses and appropriate HTTP status codes.
- Deployment/runbook docs reference the correct checks where applicable.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```

