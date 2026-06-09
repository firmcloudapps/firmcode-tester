# Task 9.4a: Authorization Foundation

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.0 and Task 9.4, docs/TASK_PROMPTS.md Task 9.0 and Task 9.4, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md.
Code context requirement: Before implementing, inspect existing InsForge auth integration, API guards/middleware, workspace or installation stores, dashboard API modules, tests, and shared role types before introducing new abstractions.

Implement the reusable InsForge-backed application authorization foundation for dashboard APIs on top of the Task 9.0 InsForge token verification/request context. Add or complete utilities/guards/services that resolve the authenticated InsForge user, workspace or organization, membership role, and Firmcode internal workspace mapping. Define the simplified Admin/Developer role capability matrix in code using typed constants or policies.

This task should not trust `x-firmcode-user-id`, `FIRMCODE_DASHBOARD_USER_ID`, or other caller-supplied identity values in production. Its goal is a reusable authorization layer with tests and enough endpoint coverage to prove tenant-scoped list/detail/mutation behavior before later tasks apply it everywhere.

Testing requirements:
- Add unit tests for role capability decisions.
- Add tests for missing session, missing workspace, unknown workspace, inactive membership, and role resolution.
- Add representative API tests proving a protected endpoint uses the authorization layer.
- Add tests that confirm authorization failures do not leak resource existence across workspaces.
- Add tests that spoofed user/workspace headers cannot impersonate another InsForge user.

Acceptance criteria:
- Dashboard APIs have a reusable InsForge-backed authorization foundation.
- Admin/Developer capabilities are represented in code.
- Workspace membership can be resolved and denied consistently.
- Production identity comes from verified InsForge claims, not headers.
- Representative endpoints enforce the new layer.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
