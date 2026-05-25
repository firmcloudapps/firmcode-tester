# Task 9.0b: Web-To-API Clerk Token Forwarding

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.0, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/LOCAL_DEVELOPMENT.md, docs/ADR.md ADR-012.
Code context requirement: Before implementing, inspect apps/web/lib/dashboard-api-proxy.ts, apps/web/lib/dashboard-data.ts, apps/web/app/api/* route handlers, apps/web/app/auth/github/route.ts, apps/web/app/api/auth/github/callback/route.ts, web tests around dashboard data/actions, and current env usage for FIRMCODE_DASHBOARD_*.

Replace env/header-shim authentication in the Next.js dashboard with Clerk session-token forwarding. Server components and route handlers should read Clerk auth state with @clerk/nextjs server helpers. Web-to-API calls must send Authorization: Bearer <Clerk session token> using the configured CLERK_JWT_AUDIENCE/template. The user ID must not be sent from FIRMCODE_DASHBOARD_CLERK_USER_ID in production.

Keep an explicit test/local bypass only where tests need stable fixtures, and name it clearly so it cannot be mistaken for production auth. If a workspace selector is still needed, pass only the workspace ID as a selector after Clerk authentication; never pass caller identity as a trusted header.

Update all dashboard API client paths:
- server data loaders in apps/web/lib/dashboard-data.ts
- mutation proxy route handlers under apps/web/app/api
- GitHub OAuth start and callback routes
- billing/settings/repository/review-run/policy sync paths

Testing requirements:
- Add tests that authenticated web requests include Authorization and no x-firmcode-user-id header.
- Add tests that missing Clerk session yields a redirect or 401-safe state before calling the API.
- Add tests that mutation proxy routes forward Clerk bearer tokens.
- Add tests that GitHub OAuth start/callback routes require a signed-in Clerk session.
- Update any tests that previously depended on FIRMCODE_DASHBOARD_* so the bypass is explicit and isolated.

Acceptance criteria:
- Web-to-API requests use Clerk bearer tokens.
- Production request creation no longer reads FIRMCODE_DASHBOARD_CLERK_USER_ID as caller identity.
- x-firmcode-user-id is not emitted by production web code.
- GitHub OAuth start and callback bind to the signed-in Clerk session.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
