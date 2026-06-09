# Task 9.0: Complete InsForge Authentication Foundation

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.0, docs/TASK_PROMPTS.md Task 9.0, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/LOCAL_DEVELOPMENT.md, docs/DASHBOARD_DESIGN.md, docs/ADR.md ADR-012.
Code context requirement: Before implementing, inspect the current InsForge provider boundary, dashboard shell, dashboard data loaders, dashboard API proxy, Next.js route handlers, API controllers, dashboard auth store, settings/billing/GitHub modules, package manifests, config validation, and tests.

Implement complete InsForge-backed dashboard authentication. Replace the no-op InsForge provider with @insforge/sdk InsForge SDK auth boundary, add /sign-in and /sign-up pages using the dedicated auth-page design in docs/DASHBOARD_DESIGN.md, protect dashboard pages and route handlers with InsForge auth checks, render user account controls and workspace switcher where enabled, derive active workspace from InsForge organization or personal workspace state, and send InsForge bearer tokens from web route handlers/server code to the API.

Install a InsForge server verification package in apps/api, add a shared Nest auth guard/request context, resolve InsForge user/org claims to Firmcode workspace membership and role, and reject missing/invalid tokens plus spoofed user headers. FIRMCODE_DASHBOARD_* may remain only as explicit test/local bypass fixtures, not production auth.

Testing requirements:
- Add web route-protection tests for authenticated and unauthenticated users.
- Add sign-in/sign-up route rendering and responsive layout tests.
- Add dashboard shell tests for InsForge user menu, organization switcher, and active workspace display.
- Add API guard tests for missing token, invalid token, expired token, valid personal workspace token, and valid organization token.
- Add tests proving client-provided user headers cannot impersonate another InsForge user.
- Add an integration test proving the dashboard can call a protected API route with a InsForge token.

Acceptance criteria:
- The dashboard has real InsForge provider, middleware, sign-in, sign-up, user menu, and organization/workspace controls.
- Sign-in and sign-up pages match the light-mode auth-page design and do not use the dashboard shell or marketing hero treatment.
- Dashboard pages and route handlers are inaccessible without a InsForge session.
- Web-to-API requests use InsForge bearer tokens.
- API protected routes verify InsForge tokens server-side.
- Workspace membership and role are resolved from verified InsForge claims.
- Production auth no longer trusts env-provided or client-provided user identity headers.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
