# Task 9.8b: Dashboard Visual Navigation QA

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.8, docs/TASK_PROMPTS.md Task 9.8, docs/PRD.md, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md.
Code context requirement: Before implementing, inspect the dashboard layout, brand tokens, sidebar/topbar, overview, repositories, review runs, findings, settings, billing, and any browser or visual smoke tooling in the repo.

Perform dashboard navigation and visual QA after route-readiness changes. Verify the full-width light dashboard layout, brand color usage, responsive desktop/mobile behavior, no text overflow, no active dead links, disabled planned controls, and usable empty/loading/error states.

Use existing component tests and browser smoke tooling where available. If a browser smoke command cannot run locally, document the exact command and failure.

Testing requirements:
- Run or add a browser smoke test across Overview, Repositories, Review Runs, Findings, Settings, Billing, and any newly enabled dashboard pages.
- Verify desktop and mobile navigation states.
- Add or update snapshots only if the repo already uses them for dashboard components.

Acceptance criteria:
- Dashboard visual/navigation QA covers the refreshed full-width layout.
- Active and disabled navigation states are visually clear and accessible.
- No dashboard primary action leads to a 404.
- Tests or documented smoke-check failures are recorded with exact commands.
```
