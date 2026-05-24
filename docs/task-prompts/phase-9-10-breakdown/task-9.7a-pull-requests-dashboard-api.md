# Task 9.7a: Pull Requests Dashboard API

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.7, docs/TASK_PROMPTS.md Task 9.7, docs/PRD.md, docs/AUTHORIZATION.md, docs/WEBHOOK_IDEMPOTENCY.md, docs/LARGE_PR_HANDLING.md.
Code context requirement: Before implementing, inspect pull request persistence, repository ownership checks, review run APIs, findings APIs, dashboard DTOs, filter validation patterns, and tests.

Implement dashboard APIs for pull request list and detail/history views. The list should support filters for repository, status, risk level, review status, author, and date range. Detail should return summary, changed components, risk analysis, review timeline, findings, metadata, branches, commit SHA, changed files, duration, and GitHub link where available.

All responses must be scoped to the caller workspace and repository ownership. Malformed filters should return validation errors rather than broad queries.

Testing requirements:
- Add API tests for PR list filters, PR detail, empty results, malformed filters, workspace ownership, cross-workspace denial, and missing PR.
- Add tests for pagination or limit behavior if the existing API pattern supports it.
- Add tests ensuring private repository metadata is not exposed across workspaces.

Acceptance criteria:
- Pull request dashboard APIs are implemented with typed DTOs.
- Filters are validated and ownership-scoped.
- Detail responses include the required dashboard data where available.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
