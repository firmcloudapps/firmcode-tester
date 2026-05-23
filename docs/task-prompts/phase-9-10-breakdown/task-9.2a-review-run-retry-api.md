# Task 9.2a: Review Run Retry API

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.2, docs/TASK_PROMPTS.md Task 9.2, docs/PRD.md, docs/AUTHORIZATION.md, docs/WEBHOOK_IDEMPOTENCY.md, docs/OPERATIONS_RUNBOOK.md.
Code context requirement: Before implementing, inspect the current Firmcode codebase for wider context: use fast searches such as `rg` and `rg --files`, read existing API modules, queue/job code, database stores, tests, package scripts, and adjacent dashboard DTOs, then follow discovered implementation patterns.

Implement the dashboard API path for retrying failed review runs. Add or complete a typed endpoint equivalent to `POST /api/review-runs/:id/retry` that validates the run ID, checks that the run belongs to the caller's workspace, only allows retryable failed runs, creates a new queued job or retries the failed run according to existing queue semantics, and persists enough state to avoid duplicate retry jobs. Do not post to GitHub from this endpoint; it should only enqueue or schedule the retry.

The endpoint response should be typed and stable for the dashboard: include the original run ID, retry run/job ID where available, new status, and a user-displayable message or machine-readable reason for non-retryable states.

Testing requirements:
- Add API tests for successful retry of a failed run.
- Add validation tests for malformed IDs, missing runs, non-failed runs, deterministic validation failures that should not retry, and duplicate retry attempts.
- Add authorization tests for workspace membership and cross-workspace denial.
- Add a queue integration test or mocked queue assertion proving a retry job is created exactly once.

Acceptance criteria:
- Retry button support exists through a typed dashboard API.
- A failed review run can be retried without creating duplicate jobs.
- Non-retryable runs return clear validation errors.
- Workspace/resource authorization is enforced before retrying.
- Tests pass through the documented local command, or inability to run them is documented with the exact command and failure.
```

