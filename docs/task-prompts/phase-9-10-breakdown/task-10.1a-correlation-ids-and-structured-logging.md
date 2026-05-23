# Task 10.1a: Correlation IDs And Structured Logging

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 10.1, docs/TASK_PROMPTS.md Task 10.1, docs/OPERATIONS_RUNBOOK.md, docs/DEPLOYMENT.md, docs/PRIVACY_RETENTION.md.
Code context requirement: Before implementing, inspect existing API logger usage, worker logging, webhook handlers, queue processors, GitHub publishers, config modules, tests, and any request ID middleware.

Add structured logging and correlation IDs across the webhook and review-run lifecycle. Ensure each review run has a correlation ID that is created or propagated from webhook ingestion into queued jobs, worker stages, artifacts, and GitHub publishing logs. Logs should be structured objects or consistent key-value fields and include run ID, repository, PR number, installation ID, stage, status, duration where known, and failure reason where safe.

Never log secrets, GitHub tokens, webhook signatures, private keys, raw private diffs, full CI logs, or unredacted artifacts. Follow existing redaction helpers or add one if needed.

Testing requirements:
- Add logger context tests for webhook ingestion, queue job creation, worker stage logging, and publishing.
- Add tests proving correlation ID is persisted or propagated through job payloads.
- Add redaction assertions for known sensitive fields in structured log payloads.
- Add failure logging tests that include safe error codes/messages without sensitive raw content.

Acceptance criteria:
- Every review run has a correlation ID.
- Webhook, queue, worker, and publisher logs include consistent structured context.
- Failures include safe reasons and stage names.
- Sensitive values are redacted or omitted.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```

