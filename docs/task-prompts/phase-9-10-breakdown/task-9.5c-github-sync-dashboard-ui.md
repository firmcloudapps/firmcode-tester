# Task 9.5c: GitHub Sync Dashboard UI

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.5, docs/TASK_PROMPTS.md Task 9.5, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md.
Code context requirement: Before implementing, inspect the repository list, settings GitHub App tab, dashboard API client/fetch patterns, toast or status components, authorization-aware UI patterns, and existing component tests.

Wire Connect GitHub, PR Review, required GitHub OAuth account status, installation status, Sync GitHub, and repository row sync controls to the implemented GitHub OAuth, installation, and repository sync APIs. Controls must show loading, success, error, empty, unauthorized, and disabled states, and must prevent duplicate clicks during in-flight sync.

Use the PR Review workspace pattern from docs/DASHBOARD_DESIGN.md: provider tabs with GitHub active and future providers disabled, separate cards for required GitHub account/OAuth and GitHub App installation status, and compact repository automation rows with readiness, enabled state, last review/run, configure, and run/retry actions.

Every user must connect GitHub OAuth before GitHub-backed workflows become available. Developers can continue from OAuth connection into GitHub App installation, repository sync, automation, and report analysis controls where plan limits allow. Admins can do the same and additionally manage billing, member access, global workspace settings, and support/safety controls.

Planned, unavailable, or plan-limited actions must be disabled rather than linked to missing routes.

Testing requirements:
- Add component tests for missing OAuth, OAuth connected, no installation, connected installation, provider tabs, repository automation rows, sync loading, sync success, sync error, unauthorized role, and disabled planned states.
- Add interaction tests proving duplicate sync clicks are blocked.
- Add route/navigation tests for Connect GitHub and Sync GitHub actions.

Acceptance criteria:
- GitHub connection and sync controls are functional where supported.
- The PR Review workspace exposes connection health and repository automation status in one implemented page or route.
- Unauthorized or plan-limited actions show read-only or disabled states.
- No sync/connect control routes to a missing page.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
