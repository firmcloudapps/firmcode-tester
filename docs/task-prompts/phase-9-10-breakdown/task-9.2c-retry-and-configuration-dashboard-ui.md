# Task 9.2c: Retry And Configuration Dashboard UI

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.2, docs/TASK_PROMPTS.md Task 9.2, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md.
Code context requirement: Before implementing, inspect existing Next.js routes, dashboard components, typed DTOs, API clients, tests, Tailwind patterns, and InsForge integration. Follow current UI primitives and do not create a parallel design system.

Add dashboard controls for retrying failed review runs and enabling/disabling repository automation. Place retry actions where users already inspect failed review runs. Place repository automation controls where repository list/detail or configuration UI expects them. Controls must prevent duplicate clicks while a request is pending, show success and error states, and refresh or optimistically update typed state consistently with existing dashboard patterns.

The UI must remain light-mode, compact, responsive, and accessible. Use appropriate controls: buttons for retry actions, toggles or switches for automation, disabled and busy states for pending mutations, and inline feedback for validation or authorization failures.

Testing requirements:
- Add component or interaction tests for retry success, retry failure, duplicate-click prevention, and disabled/non-retryable states.
- Add component or interaction tests for repository automation enable/disable success and failed validation/authorization responses.
- Add loading, empty, error, and populated state coverage where the touched views require it.
- Add or document a desktop/mobile visual smoke check for the affected dashboard pages.

Acceptance criteria:
- Failed runs expose a usable retry action.
- Repository automation can be toggled from the dashboard and reflects persisted API state.
- Duplicate retry clicks are prevented in the UI.
- Success, pending, and error states are clear and accessible.
- Tests and visual smoke checks pass, or inability to run them is documented with exact commands.
```

