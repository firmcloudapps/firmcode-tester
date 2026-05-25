# Task 9.0c: API Clerk Token Guard And Request Context

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.0, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/PRIVACY_RETENTION.md, docs/ADR.md ADR-012.
Code context requirement: Before implementing, inspect apps/api/package.json, apps/api/src/modules/app.module.ts, all dashboard controllers, apps/api/src/modules/review-runs/dashboard-auth.store.ts, config validation, tests using x-firmcode-user-id/x-firmcode-workspace-id, and existing Nest module/provider patterns.

Implement a shared NestJS Clerk authentication foundation for dashboard APIs. Install a Clerk server verification package such as @clerk/backend, validate Authorization: Bearer <Clerk session token>, enforce CLERK_JWT_AUDIENCE, and create a request context containing Clerk user ID, Clerk organization ID when present, session ID, selected/resolved workspace ID, membership role, and derived capabilities.

Apply the guard to dashboard API routes, not GitHub webhook routes. GitHub webhooks remain protected by GitHub signature verification and installation ownership checks. Controllers must stop trusting x-firmcode-user-id in production. If x-firmcode-workspace-id remains as an optional selector, the guard must verify the authenticated Clerk user belongs to that workspace before it reaches controller logic.

Use shared decorators/helpers for:
- requiring authenticated dashboard context
- requiring a role/capability
- returning 401 for missing/invalid tokens
- returning 403 for authenticated-but-insufficient capability
- returning 404 for cross-workspace resources where revealing existence would leak tenant data

Testing requirements:
- Add guard unit tests for missing token, malformed header, invalid token, expired token, wrong audience, valid personal workspace token, and valid organization token.
- Add controller integration tests proving protected routes reject missing tokens before controller logic.
- Add tests proving x-firmcode-user-id cannot impersonate another Clerk user.
- Add tests proving webhook endpoints do not require Clerk tokens and still require GitHub signatures.
- Add config validation tests for CLERK_SECRET_KEY and CLERK_JWT_AUDIENCE.

Acceptance criteria:
- apps/api verifies Clerk bearer tokens server-side.
- Dashboard request context is available to controllers/services.
- Dashboard controllers no longer derive identity from caller-supplied user headers.
- Missing/invalid tokens return 401.
- Webhooks are not accidentally Clerk-gated.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
