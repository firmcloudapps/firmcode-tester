# Task 9.5a: GitHub Installation Entry Point

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.5, docs/TASK_PROMPTS.md Task 9.5, docs/PRD.md, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md.
Code context requirement: Before implementing, inspect the current dashboard shell, topbar Connect GitHub action, settings GitHub App tab, Next.js route tree, Clerk auth helpers, environment config, and tests.

Implement the authenticated GitHub OAuth plus GitHub App installation entry point. Add or complete /github/installations so Connect GitHub routes to a real page or route that shows required GitHub OAuth account status, current GitHub App setup status, installation instructions, configured GitHub App install URL, missing-config state, and safe retry/error states. Every signed-in Firmcode user must connect GitHub OAuth before using GitHub-backed workflows; Owners/Admins additionally manage GitHub App installation. If the app shell exposes a PR Review navigation item, it should lead to this setup/status workspace or another implemented route, not a placeholder.

The page must not expose private keys, webhook secrets, OAuth client secrets, OAuth access tokens, installation tokens, or raw GitHub payloads. If GitHub App or OAuth environment variables are missing, show a disabled state with actionable setup copy for local development.

Testing requirements:
- Add route/component tests for signed-out, signed-in with missing OAuth, OAuth connected with no installation, configured install URL, missing install config, and error state.
- Add navigation tests proving Connect GitHub and PR Review do not point at missing internal routes.
- Add or update environment/config tests if install URL derivation depends on config validation.

Acceptance criteria:
- /github/installations exists and is Clerk-authenticated.
- GitHub OAuth connection is presented as a required per-user step before GitHub-backed workflows.
- Connect GitHub and PR Review reach real implemented destinations or explicit disabled states.
- Missing config is handled without leaking secrets.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
