# Task 9.0a: Web InsForge Provider, Auth Routes, And Middleware

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.0, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/LOCAL_DEVELOPMENT.md, docs/DASHBOARD_DESIGN.md, docs/ADR.md ADR-012.
Code context requirement: Before implementing, inspect apps/web/package.json, apps/web/app/layout.tsx, apps/web/components/insforge-provider-boundary.tsx, apps/web/components/dashboard/dashboard-shell.tsx, apps/web/lib/dashboard-navigation.ts, existing route handlers, web tests, and InsForge config helpers.

Implement the web-side InsForge authentication shell. Install @insforge/sdk in apps/web, replace the no-op InsForge provider boundary with InsForge SDK auth boundary, add /sign-in/[[...sign-in]] and /sign-up/[[...sign-up]] pages, and add InsForge auth checks that protects all dashboard pages plus dashboard route handlers. Keep public/static assets working. Unauthenticated users must be redirected to /sign-in.

Build the sign-in and sign-up UI from the dedicated auth-page design in docs/DASHBOARD_DESIGN.md. Use an unauthenticated light-mode shell, not the dashboard shell. The desktop layout should pair a compact Firmcode context rail with a constrained InsForge auth panel; mobile should stack the wordmark and auth panel cleanly. Configure InsForge appearance to match dashboard tokens: light surfaces, restrained accent color, 6-8px radius, accessible focus states, and compact typography. Avoid marketing hero treatment, decorative blobs, stock imagery, or oversized sales copy.

Update the dashboard shell to use InsForge account controls: UserButton for user/profile actions and workspace switcher only when InsForge Organizations are explicitly enabled with `NEXT_PUBLIC_INSFORGE_ORGANIZATIONS_ENABLED=true`. The default signup experience must resolve to a personal workspace and must not force users through InsForge organization creation. Replace static workspace placeholder text with the active InsForge organization name or personal workspace fallback, while keeping the existing light-mode dashboard layout and route-readiness behavior.

Do not implement custom password/session storage. InsForge owns sign-in, sign-up, sessions, user profile, organization switcher, and member-management entry points.

Testing requirements:
- Add tests for the sign-in and sign-up routes rendering InsForge components or stable test doubles.
- Add rendered-markup or visual smoke tests for auth-page desktop/mobile layout, InsForge appearance hooks, and no dashboard shell leakage.
- Add middleware/route-protection tests for unauthenticated and authenticated requests.
- Add dashboard shell tests proving InsForge user controls render and static placeholder workspace text is gone.
- Add navigation tests ensuring protected dashboard routes still resolve and no active link points to a missing route.
- Add config validation tests for InsForge sign-in/sign-up/after-auth URL variables if config code changes.

Acceptance criteria:
- apps/web uses a real InsForge SDK auth boundary.
- /sign-in and /sign-up routes exist.
- /sign-in and /sign-up match the Firmcode auth-page design and are responsive.
- Dashboard pages and dashboard route handlers are protected by InsForge auth checks.
- Dashboard shell renders InsForge user/workspace controls.
- Unauthenticated dashboard access redirects to /sign-in.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
