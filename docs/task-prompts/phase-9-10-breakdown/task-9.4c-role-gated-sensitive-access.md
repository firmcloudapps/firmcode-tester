# Task 9.4c: Role-Gated Sensitive Access

Ensure you read the existing code on this task before you make any change
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.4, docs/TASK_PROMPTS.md Task 9.4, docs/AUTHORIZATION.md, docs/PRIVACY_RETENTION.md, docs/DASHBOARD_DESIGN.md.
Code context requirement: Before implementing, inspect existing authorization policies, dashboard routes, settings and billing APIs, artifact access paths, review run detail UI, and tests.

Enforce role capabilities for sensitive dashboard actions using only the MVP roles: Admin and Developer. Admins can manage billing, member access where InsForge allows, retention, API keys, global workspace policies, and support/safety controls. Developers can connect GitHub, add/sync repositories, configure repository-level automation, view runs/findings, retry failed runs unless policy disables it, trigger scans where plan allows, and inspect allowed redacted artifacts.

Role-gate raw artifact access explicitly. If raw artifacts include diffs, logs, LLM prompts, model outputs, or Semgrep raw output, require the elevated role defined in docs/AUTHORIZATION.md and docs/PRIVACY_RETENTION.md. Redacted summaries can remain accessible to lower roles if already designed.

Testing requirements:
- Add role capability tests for Admin and Developer across retry, repository config, settings, billing, and raw artifact access.
- Add API tests for sensitive settings and billing role denial.
- Add raw artifact access tests for elevated and non-elevated roles.
- Add UI tests for disabled/hidden sensitive controls where dashboard behavior depends on role.

Acceptance criteria:
- Admin/Developer capabilities are enforced for sensitive dashboard APIs.
- Billing and sensitive settings require elevated roles.
- Raw artifact access is role-gated.
- UI does not offer unauthorized sensitive actions as active controls.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.

