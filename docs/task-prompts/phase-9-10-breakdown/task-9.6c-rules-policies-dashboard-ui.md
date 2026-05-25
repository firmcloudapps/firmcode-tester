# Task 9.6c: Rules And Policies Dashboard UI

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.6, docs/TASK_PROMPTS.md Task 9.6, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md.
Code context requirement: Before implementing, inspect dashboard shell/sidebar, settings/configuration form patterns, repository configuration UI, API client patterns, unsaved-change handling, validation components, and tests.

Build /rules as the Rules / Policies dashboard page. Include sections for review preferences, comment policy, prompt instructions, ignored paths, generated-file patterns, Semgrep/analysis toggles, and infrastructure/security policy controls.

Use accessible form controls, validation states, loading/error/empty/populated states, and unsaved-change handling. Developers can save repository-level review policy changes. Admins can also save global workspace, retention, API key, billing, and support/safety policy changes. Controls that exceed the user's role or plan must be read-only or disabled according to docs/AUTHORIZATION.md.

Testing requirements:
- Add component tests for loading, empty, error, populated, validation error, unsaved changes, save success, save failure, and read-only role states.
- Add navigation tests proving Rules / Policies sidebar link does not 404 when enabled.
- Add responsive desktop/mobile visual smoke coverage or document the exact command that could not run.

Acceptance criteria:
- /rules is implemented and matches docs/DASHBOARD_DESIGN.md.
- Save behavior calls the role-gated Rules / Policies API.
- Unauthorized users cannot mutate policies through active controls.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
