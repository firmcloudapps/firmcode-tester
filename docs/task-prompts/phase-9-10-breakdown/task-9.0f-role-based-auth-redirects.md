# Task 9.0f: Role-Based Auth Redirects

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.0, docs/PRD.md SaaS Product Model and MVP Scope, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/LOCAL_DEVELOPMENT.md, docs/DASHBOARD_DESIGN.md, docs/ADR.md ADR-012.
Code context requirement: Before implementing, inspect apps/web/components/auth/auth-page.tsx, apps/web/components/clerk-provider-boundary.tsx, apps/web/app/sign-in/[[...sign-in]]/page.tsx, apps/web/app/sign-up/[[...sign-up]]/page.tsx, apps/web/lib/dashboard-api-proxy.ts, apps/web/lib/dashboard-data.ts, apps/web/lib/protected-routes.ts, apps/web/lib/dashboard-route-readiness.ts, apps/web/app/github/installations/page.tsx, apps/web/app/settings/page.tsx, and existing Clerk/dashboard route tests.

Implement role-based post-auth routing so successful Clerk sign-in and sign-up never leave the user on /sign-in. Add a protected /auth/redirect route that uses the existing Clerk-authenticated dashboard API path, preferably /api/settings, to read the verified workspace role. Redirect Admin and owner-equivalent roles to /admin. Redirect Developer and member-equivalent roles to /developer. Unsupported or read-only roles must fall back to /developer without granting additional capabilities. Missing or invalid sessions must redirect to /sign-in.

Add explicit /admin and /developer dashboard routes. /admin should reuse the existing dashboard shell and Admin-relevant workspace controls such as Settings, Billing, members, and global workspace controls. /developer should reuse the existing dashboard shell and PR Review/GitHub setup workflow. Do not introduce a new auth bypass, duplicate role policy, or client-controlled role source; the role decision must come from the API context already protected by Clerk token verification.

Update Clerk SignIn, SignUp, and provider configuration to force successful sign-in/sign-up through /auth/redirect while keeping existing fallback redirect configuration available for resilience. If an already signed-in user visits /sign-in or /sign-up, send them through /auth/redirect.

Testing requirements:
- Add tests proving SignIn and SignUp are configured to complete through /auth/redirect.
- Add tests proving /auth/redirect sends Admin/owner to /admin and Developer/member to /developer.
- Add tests for missing session, invalid session, unsupported role, and API failure fallback.
- Add route protection and route-readiness tests for /auth/redirect, /admin, and /developer.
- Add component/page tests proving /admin and /developer render the dashboard shell and reuse existing role-gated surfaces.
- Run npm run test --workspace @firmcode/web and npm run lint --workspace @firmcode/web, or document exact failures.

Acceptance criteria:
- Authenticated users do not remain on /sign-in after sign-in or sign-up.
- /auth/redirect is protected and resolves role through verified dashboard auth context.
- /admin and /developer exist and route to implemented dashboard pages.
- Role routing does not grant new privileges or trust client-supplied role data.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
