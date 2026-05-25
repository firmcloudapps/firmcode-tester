# Task 9.0a: Web Clerk Provider, Auth Routes, And Middleware

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.0, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/LOCAL_DEVELOPMENT.md, docs/DASHBOARD_DESIGN.md, docs/ADR.md ADR-012.
Code context requirement: Before implementing, inspect apps/web/package.json, apps/web/app/layout.tsx, apps/web/components/clerk-provider-boundary.tsx, apps/web/components/dashboard/dashboard-shell.tsx, apps/web/lib/dashboard-navigation.ts, existing route handlers, web tests, and Clerk config helpers.

Implement the web-side Clerk authentication shell. Install @clerk/nextjs in apps/web, replace the no-op Clerk provider boundary with ClerkProvider, add /sign-in/[[...sign-in]] and /sign-up/[[...sign-up]] pages, and add Clerk middleware that protects all dashboard pages plus dashboard route handlers. Keep public/static assets working. Unauthenticated users must be redirected to /sign-in.

Update the dashboard shell to use Clerk account controls: UserButton for user/profile actions and OrganizationSwitcher when Clerk Organizations are enabled. Replace static workspace placeholder text with the active Clerk organization name or personal workspace fallback, while keeping the existing light-mode dashboard layout and route-readiness behavior.

Do not implement custom password/session storage. Clerk owns sign-in, sign-up, sessions, user profile, organization switcher, and member-management entry points.

Testing requirements:
- Add tests for the sign-in and sign-up routes rendering Clerk components or stable test doubles.
- Add middleware/route-protection tests for unauthenticated and authenticated requests.
- Add dashboard shell tests proving Clerk user controls render and static placeholder workspace text is gone.
- Add navigation tests ensuring protected dashboard routes still resolve and no active link points to a missing route.
- Add config validation tests for Clerk sign-in/sign-up/after-auth URL variables if config code changes.

Acceptance criteria:
- apps/web uses a real ClerkProvider.
- /sign-in and /sign-up routes exist.
- Dashboard pages and dashboard route handlers are protected by Clerk middleware.
- Dashboard shell renders Clerk user/workspace controls.
- Unauthenticated dashboard access redirects to /sign-in.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
