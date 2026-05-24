# Task 9.5b: GitHub Installation And Repository Sync API

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.5, docs/TASK_PROMPTS.md Task 9.5, docs/PRD.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/WEBHOOK_IDEMPOTENCY.md, docs/PRIVACY_RETENTION.md.
Code context requirement: Before implementing, inspect existing GitHub App config, GitHub OAuth/client config, installation persistence, repository persistence, GitHub adapters, dashboard repository APIs, authorization helpers, webhook ownership checks, and API tests.

Implement required per-user GitHub OAuth status plus workspace-scoped GitHub installation and repository sync APIs. Add or complete endpoints to start OAuth, handle OAuth callback, store safe GitHub user identity metadata, return OAuth connection status for the signed-in Firmcode user without exposing OAuth access tokens, list installations available to the caller workspace, sync installation repository metadata, and sync a single repository metadata record.

All endpoints must require Clerk-backed workspace membership, require connected GitHub OAuth before GitHub-backed workflows, verify repository installation ownership, avoid persisting plaintext tokens, and use existing GitHub adapter boundaries. Repository review, sync, webhook handling, and PR publishing must use GitHub App installation tokens rather than users' OAuth tokens. Sync behavior must be idempotent and safe to retry.

Testing requirements:
- Add API tests for OAuth missing/connected status, OAuth callback validation, installation listing, installation sync, repository sync, repeated sync idempotency, role denial, cross-workspace denial, missing installation, and GitHub adapter failure.
- Add validation tests for malformed repository IDs or installation IDs.
- Add tests that secrets/tokens are not returned in API responses.

Acceptance criteria:
- Installation and repository sync APIs are implemented behind existing module boundaries.
- GitHub OAuth status/callback APIs are implemented behind existing module boundaries and return no OAuth access tokens.
- Sync writes only workspace-owned installation/repository metadata.
- API responses omit secrets and plaintext tokens.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
