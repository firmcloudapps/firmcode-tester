# Task 9.5b: GitHub Installation And Repository Sync API

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.5, docs/TASK_PROMPTS.md Task 9.5, docs/PRD.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/WEBHOOK_IDEMPOTENCY.md, docs/PRIVACY_RETENTION.md.
Code context requirement: Before implementing, inspect existing GitHub App config, installation persistence, repository persistence, GitHub adapters, dashboard repository APIs, authorization helpers, webhook ownership checks, and API tests.

Implement workspace-scoped GitHub installation and repository sync APIs. Add or complete endpoints for listing installations available to the caller workspace, syncing installation repository metadata, and syncing a single repository metadata record.

All endpoints must require Clerk-backed workspace membership, verify repository installation ownership, avoid persisting plaintext tokens, and use existing GitHub adapter boundaries. Sync behavior must be idempotent and safe to retry.

Testing requirements:
- Add API tests for installation listing, installation sync, repository sync, repeated sync idempotency, role denial, cross-workspace denial, missing installation, and GitHub adapter failure.
- Add validation tests for malformed repository IDs or installation IDs.
- Add tests that secrets/tokens are not returned in API responses.

Acceptance criteria:
- Installation and repository sync APIs are implemented behind existing module boundaries.
- Sync writes only workspace-owned installation/repository metadata.
- API responses omit secrets and plaintext tokens.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
