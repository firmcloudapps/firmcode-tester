# Task 9.4b: Dashboard Resource Ownership Enforcement

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.4, docs/TASK_PROMPTS.md Task 9.4, docs/AUTHORIZATION.md, docs/PRD.md, docs/PRIVACY_RETENTION.md.
Code context requirement: Before implementing, inspect every dashboard API/resource module, route handler, store query, DTO, and existing tests. Use `rg` to find routes for repositories, pull requests, review runs, findings, CI failures, artifacts, settings, and billing.

Apply the authorization foundation to every dashboard API resource type. Each API must check workspace membership and resource ownership before reading or mutating data. Store queries should constrain by workspace or installation ownership instead of fetching globally and filtering late. Cross-workspace resource IDs must return the existing not-found/forbidden pattern without leaking sensitive details.

Keep changes scoped to dashboard API authorization. Do not change unrelated worker pipeline behavior unless a dashboard endpoint depends on it.

Testing requirements:
- Add API authorization tests for each dashboard resource type: repositories, pull requests, review runs, findings, CI failures if present, artifacts, settings, and billing/usage endpoints.
- Add cross-workspace denial tests for list and detail endpoints.
- Add mutation denial tests for repository configuration and retry endpoints if they exist.
- Add regression tests proving valid same-workspace access still works.

Acceptance criteria:
- Every dashboard API checks workspace membership and resource ownership.
- Store queries are ownership-scoped where practical.
- Cross-workspace access is denied consistently.
- Existing authorized dashboard behavior continues to work.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```

