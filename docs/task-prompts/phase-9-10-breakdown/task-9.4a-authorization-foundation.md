# Task 9.4a: Authorization Foundation

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.4, docs/TASK_PROMPTS.md Task 9.4, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md.
Code context requirement: Before implementing, inspect existing Clerk auth integration, API guards/middleware, workspace or installation stores, dashboard API modules, tests, and shared role types before introducing new abstractions.

Implement the reusable Clerk-backed application authorization foundation for dashboard APIs. Add or complete utilities/guards/services that resolve the authenticated Clerk user, workspace or organization, membership role, and Firmcode internal workspace mapping. Define the role capability matrix for Owner, Admin, Developer, and Viewer in code using typed constants or policies.

This task should not retrofit every endpoint unless the codebase is small enough to do safely. Its goal is a reusable authorization layer with tests and one or two representative endpoint integrations that later tasks can apply everywhere.

Testing requirements:
- Add unit tests for role capability decisions.
- Add tests for missing session, missing workspace, unknown workspace, inactive membership, and role resolution.
- Add representative API tests proving a protected endpoint uses the authorization layer.
- Add tests that confirm authorization failures do not leak resource existence across workspaces.

Acceptance criteria:
- Dashboard APIs have a reusable Clerk-backed authorization foundation.
- Owner/Admin/Developer/Viewer capabilities are represented in code.
- Workspace membership can be resolved and denied consistently.
- Representative endpoints enforce the new layer.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```

