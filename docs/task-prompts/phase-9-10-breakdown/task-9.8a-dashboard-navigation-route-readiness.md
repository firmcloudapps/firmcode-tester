# Task 9.8a: Dashboard Navigation Route Readiness

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.8, docs/TASK_PROMPTS.md Task 9.8, docs/PRD.md, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md.
Code context requirement: Before implementing, inspect the Next.js app route tree, dashboard sidebar/topbar navigation definitions, overview needs-attention links, repository row actions, settings actions, billing actions, route tests, and component tests.

Create a route-readiness guard for dashboard navigation. Active internal links and primary actions must map to implemented app routes. Planned destinations must be disabled controls with accessible labels/titles rather than active links.

Add tests that enumerate dashboard nav/action definitions and fail when an active internal route is missing. Keep external Clerk/GitHub URLs explicitly marked as external and validated separately from internal routes.

Testing requirements:
- Add route manifest or component tests for sidebar links, topbar actions, overview links, repository row actions, settings actions, and billing actions.
- Add regression tests for disabled planned actions.
- Add tests that distinguish internal routes from external Clerk/GitHub URLs.

Acceptance criteria:
- No active dashboard link points at an unimplemented internal route.
- Planned actions are disabled and accessible.
- Tests catch future dead links in dashboard navigation.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
