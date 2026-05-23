# Task 9.2b: Repository Automation Configuration API

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.2, docs/TASK_PROMPTS.md Task 9.2, docs/PRD.md, docs/AUTHORIZATION.md, docs/DASHBOARD_DESIGN.md, docs/ENVIRONMENT.md.
Code context requirement: Before implementing, inspect existing repository modules, stores, DTOs, database migrations, dashboard components, tests, and shared contracts before choosing shapes or names.

Implement the API and persistence needed to enable or disable repository review automation from the dashboard. Add or complete repository configuration storage for at least `automationEnabled`, and preserve any existing review configuration fields such as draft PR behavior, max inline comments, severity threshold, Semgrep, Tree-sitter, CI explanation, infrastructure review, and dry-run mode if they already exist.

Expose typed dashboard endpoints to fetch and update repository automation/configuration. Validate input strictly, enforce workspace membership and repository ownership, and return the updated configuration in a shape the web app can consume. Keep configuration changes idempotent and auditable through timestamps or existing update metadata where the codebase supports it.

Testing requirements:
- Add API tests for enabling and disabling repository automation.
- Add validation tests for unknown fields, invalid field types, and invalid numeric bounds if configuration fields are present.
- Add authorization tests for Owner/Admin/Developer/Viewer capabilities according to docs/AUTHORIZATION.md.
- Add persistence tests proving changes survive a fresh fetch.

Acceptance criteria:
- Repository enable/disable state is persisted.
- Fetch/update endpoints use typed DTOs or shared schemas.
- Invalid configuration payloads fail with useful errors.
- Unauthorized and cross-workspace updates are denied.
- Tests pass through the documented local command, or inability to run them is documented with the exact command and failure.
```

