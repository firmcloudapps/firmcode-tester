# Task 9.0e: Auth Flow E2E Hardening And Docs

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.0 and Task 9.4, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/LOCAL_DEVELOPMENT.md, docs/RELEASE_CHECKLIST.md, docs/OPERATIONS_RUNBOOK.md, infra/deploy/vercel.md, infra/deploy/coolify.md.
Code context requirement: Before implementing, inspect completed Task 9.0a-9.0d changes, route manifests, dashboard API tests, deployment env validation, release checklist, runbook, and existing smoke-test style.

Perform the end-to-end authentication hardening pass. Verify the complete flow from browser to Clerk to Vercel dashboard to Coolify API to workspace-scoped data. Remove or quarantine any remaining production path that authenticates via FIRMCODE_DASHBOARD_* or x-firmcode-user-id. Ensure all dashboard list endpoints are tenant-scoped and protected. Ensure direct API requests without a Clerk token return 401.

Add or update smoke tests and docs so future deployments can validate:
- unauthenticated dashboard access redirects to /sign-in
- signed-in dashboard access renders the shell and active workspace
- dashboard API calls include Authorization bearer tokens
- direct API calls without token return 401
- spoofed user/workspace headers cannot impersonate another user
- cross-workspace resource requests are denied
- Owner/Admin/Developer/Viewer capabilities behave as documented
- GitHub OAuth start/callback require a signed-in Clerk user
- Billing management requires Owner/Admin or verified Clerk Billing capability

Testing requirements:
- Add an end-to-end or integration smoke test for protected dashboard-to-API calls.
- Add tenant isolation tests for representative list/detail/mutation routes.
- Add role matrix tests for sensitive actions.
- Add regression tests for spoofed headers.
- Run web and API test suites, plus lint/build where touched.

Documentation requirements:
- Update docs/LOCAL_DEVELOPMENT.md if local auth setup commands changed.
- Update docs/ENVIRONMENT.md if env vars changed.
- Update infra/deploy/vercel.md and infra/deploy/coolify.md if deployment steps changed.
- Update docs/RELEASE_CHECKLIST.md with any new required checks.
- Update docs/OPERATIONS_RUNBOOK.md with any new auth failure modes.

Acceptance criteria:
- No production dashboard path trusts caller-supplied identity headers.
- Every dashboard page and API route is Clerk-protected.
- Tenant isolation and role-gating are tested.
- Auth setup and troubleshooting docs match the implemented behavior.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
