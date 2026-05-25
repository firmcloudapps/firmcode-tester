# Task 9.0: Complete Clerk Authentication Foundation

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.0, docs/TASK_PROMPTS.md Task 9.0, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/LOCAL_DEVELOPMENT.md, docs/DASHBOARD_DESIGN.md, docs/ADR.md ADR-012.
Code context requirement: Before implementing, inspect the current Clerk provider boundary, dashboard shell, dashboard data loaders, dashboard API proxy, Next.js route handlers, API controllers, dashboard auth store, settings/billing/GitHub modules, package manifests, config validation, and tests.

Implement complete Clerk-backed dashboard authentication. Replace the no-op Clerk provider with @clerk/nextjs ClerkProvider, add /sign-in and /sign-up pages, protect dashboard pages and route handlers with Clerk middleware, render Clerk UserButton and OrganizationSwitcher where enabled, derive active workspace from Clerk organization or personal workspace state, and send Clerk bearer tokens from web route handlers/server code to the API.

Install a Clerk server verification package in apps/api, add a shared Nest auth guard/request context, resolve Clerk user/org claims to Firmcode workspace membership and role, and reject missing/invalid tokens plus spoofed user headers. FIRMCODE_DASHBOARD_* may remain only as explicit test/local bypass fixtures, not production auth.

Testing requirements:
- Add web route-protection tests for authenticated and unauthenticated users.
- Add sign-in/sign-up route rendering tests.
- Add dashboard shell tests for Clerk user menu, organization switcher, and active workspace display.
- Add API guard tests for missing token, invalid token, expired token, valid personal workspace token, and valid organization token.
- Add tests proving client-provided user headers cannot impersonate another Clerk user.
- Add an integration test proving the dashboard can call a protected API route with a Clerk token.

Acceptance criteria:
- The dashboard has real Clerk provider, middleware, sign-in, sign-up, user menu, and organization/workspace controls.
- Dashboard pages and route handlers are inaccessible without a Clerk session.
- Web-to-API requests use Clerk bearer tokens.
- API protected routes verify Clerk tokens server-side.
- Workspace membership and role are resolved from verified Clerk claims.
- Production auth no longer trusts env-provided or client-provided user identity headers.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
