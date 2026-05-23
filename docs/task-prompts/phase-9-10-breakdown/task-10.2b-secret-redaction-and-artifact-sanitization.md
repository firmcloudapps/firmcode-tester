# Task 10.2b: Secret Redaction And Artifact Sanitization

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 10.2, docs/TASK_PROMPTS.md Task 10.2, docs/PRIVACY_RETENTION.md, docs/LLM_STRATEGY.md, docs/OPERATIONS_RUNBOOK.md.
Code context requirement: Before implementing, inspect logging helpers, artifact persistence, CI log fetcher/redaction, LLM prompt/output storage, Semgrep artifact storage, tests, and privacy docs.

Implement or complete secret redaction for logs and persisted artifacts. Apply redaction before storing or displaying CI logs, raw command output, GitHub API errors, LLM request/response metadata, prompt context, Semgrep raw output, and any artifact that can contain repository or credential material. Keep structured metadata useful for debugging while avoiding tokens, authorization headers, webhook signatures, private keys, passwords, and obvious secret values.

Prefer a central redaction utility with focused tests. Do not over-sanitize file paths, line numbers, safe error codes, or status values needed for debugging.

Testing requirements:
- Add redaction unit tests for GitHub tokens, bearer auth headers, webhook signatures, private keys, API keys, passwords, database URLs, and common CI secret formats.
- Add artifact persistence tests proving redaction happens before storage.
- Add logging tests proving sensitive fields are omitted or masked.
- Add regression tests for safe metadata that should remain visible.

Acceptance criteria:
- Secrets never appear in logs or persisted artifacts covered by this task.
- Raw artifacts are sanitized before display or storage unless explicitly retention-bound and role-gated.
- Redaction behavior is centralized or consistently reused.
- Useful debugging metadata remains available.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```

