# Task 9.4c: Role-Gated Sensitive Access

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.4, docs/TASK_PROMPTS.md Task 9.4, docs/AUTHORIZATION.md, docs/PRIVACY_RETENTION.md, docs/DASHBOARD_DESIGN.md.
Code context requirement: Before implementing, inspect existing authorization policies, dashboard routes, settings and billing APIs, artifact access paths, review run detail UI, and tests.

Enforce role capabilities for sensitive dashboard actions. Billing and sensitive settings require Owner/Admin or Clerk-managed billing capability where applicable. Developers can view runs/findings, retry failed runs unless policy disables it, and inspect allowed artifacts. Viewers are read-only and must not mutate repository configuration, retry runs, manage API keys, change retention, or access raw artifacts if policy forbids it.

Role-gate raw artifact access explicitly. If raw artifacts include diffs, logs, LLM prompts, model outputs, or Semgrep raw output, require the elevated role defined in docs/AUTHORIZATION.md and docs/PRIVACY_RETENTION.md. Redacted summaries can remain accessible to lower roles if already designed.

Testing requirements:
- Add role capability tests for Owner, Admin, Developer, and Viewer across retry, repository config, settings, billing, and raw artifact access.
- Add API tests for sensitive settings and billing role denial.
- Add raw artifact access tests for elevated and non-elevated roles.
- Add UI tests for disabled/hidden sensitive controls where dashboard behavior depends on role.

Acceptance criteria:
- Owner/Admin/Developer/Viewer capabilities are enforced for sensitive dashboard APIs.
- Billing and sensitive settings require elevated roles.
- Raw artifact access is role-gated.
- UI does not offer unauthorized sensitive actions as active controls.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```

