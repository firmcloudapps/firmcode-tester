# Task 9.7b: Pull Requests Dashboard UI

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.7, docs/TASK_PROMPTS.md Task 9.7, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md.
Code context requirement: Before implementing, inspect the dashboard shell, sidebar route definitions, overview links, review run and findings components, API client patterns, table/filter components, and tests.

Build /pull-requests and pull request detail UI. The list should act as an engineering queue with filters for repository, status, risk, review status, author, and date range. The detail view should show summary, changed components, risk analysis, review timeline, findings, metadata, branches, commit SHA, files changed, review duration, and GitHub link.

Follow the full-width light dashboard layout from docs/DASHBOARD_DESIGN.md and current brand tokens. Include loading, empty, error, populated, desktop, and mobile states.

Testing requirements:
- Add component tests for list filters, populated rows, empty state, error state, loading state, and detail sections.
- Add route/navigation tests proving Pull Requests sidebar and overview links do not 404 once enabled.
- Add responsive visual smoke coverage or document the exact command that could not run.

Acceptance criteria:
- /pull-requests and PR detail views are implemented.
- List filters update the API request or local state according to existing patterns.
- UI does not expose unauthorized mutating controls.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
