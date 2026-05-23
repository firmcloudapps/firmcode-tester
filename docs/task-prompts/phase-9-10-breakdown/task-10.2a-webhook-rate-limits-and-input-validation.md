# Task 10.2a: Webhook Rate Limits And Input Validation

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 10.2, docs/TASK_PROMPTS.md Task 10.2, docs/PRIVACY_RETENTION.md, docs/AUTHORIZATION.md, docs/WEBHOOK_IDEMPOTENCY.md, docs/ENVIRONMENT.md.
Code context requirement: Before implementing, inspect webhook controllers/middleware, raw body signature verification, event normalization, config validation, tests, and any existing rate-limit or validation utilities.

Harden webhook ingestion with rate limits and stricter input validation. Rate limits must not interfere with signature verification ordering or idempotency semantics. Validate event headers, delivery IDs, supported event names, content type where applicable, payload shape, installation/repository identifiers, and configured repository allow/deny behavior only if already available from config.

Ensure invalid or unsupported input fails safely with structured errors and without logging secrets, raw payloads, signatures, or private repository content.

Testing requirements:
- Add webhook rate-limit tests for repeated requests and reset behavior where supported.
- Add validation tests for missing/invalid event headers, delivery ID, signature, content type, payload shape, installation, repository, and unsupported event.
- Add tests confirming invalid payloads are rejected before enqueueing jobs.
- Add tests confirming signature verification still happens before trusting parsed payload data.

Acceptance criteria:
- Webhook endpoint is rate-limited.
- Webhook input validation is strict and typed.
- Invalid requests do not enqueue jobs or persist trusted records.
- Errors/logs avoid raw secrets and private payload content.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```

