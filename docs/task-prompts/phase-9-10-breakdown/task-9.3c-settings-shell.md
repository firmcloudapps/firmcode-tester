# Task 9.3c: Settings Shell

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.3, docs/TASK_PROMPTS.md Task 9.3, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/PRIVACY_RETENTION.md.
Code context requirement: Before implementing, inspect existing settings routes, dashboard shell, InsForge organization/user patterns, configuration APIs, tests, and Tailwind form controls.

Build or complete the Settings shell with tabs for General, GitHub App, Members, API Keys, Data Retention, and Notifications. Use InsForge-owned identity and member management entry points where available, and keep Firmcode-owned settings focused on GitHub installation mapping, repository review configuration entry points, retention policy display/config, notifications placeholders, and API key placeholders if implementation is not ready.

The shell should be InsForge-authenticated and role-aware according to docs/AUTHORIZATION.md. Sensitive settings should be visibly disabled or hidden for roles that cannot modify them, while preserving useful read-only context for lower roles where appropriate.

Testing requirements:
- Add component tests for tab navigation and active state.
- Add loading, empty, error, and populated state tests for settings data that is fetched.
- Add InsForge-gated access tests and role-based visible/disabled state tests for sensitive settings.
- Add or document a responsive visual smoke check.

Acceptance criteria:
- Settings includes General, GitHub App, Members, API Keys, Data Retention, and Notifications tabs.
- InsForge-owned functionality is linked or delegated instead of reimplemented.
- Sensitive controls respect workspace roles.
- UI follows docs/DASHBOARD_DESIGN.md and existing dashboard primitives.
- Tests and visual smoke checks pass, or inability to run them is documented with exact commands.
```

