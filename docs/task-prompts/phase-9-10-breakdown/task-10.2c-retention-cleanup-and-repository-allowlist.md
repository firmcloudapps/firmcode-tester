# Task 10.2c: Retention Cleanup And Repository Allowlist

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 10.2, docs/TASK_PROMPTS.md Task 10.2, docs/PRIVACY_RETENTION.md, docs/AUTHORIZATION.md, docs/OPERATIONS_RUNBOOK.md, docs/ENVIRONMENT.md.
Code context requirement: Before implementing, inspect artifact models, database migrations, cleanup jobs, config modules, webhook normalization, repository stores, tests, and docs before adding new fields or jobs.

Implement configurable artifact retention and repository allowlist support for the MVP. Retention should cover raw diffs, CI logs, prompts, LLM outputs, Semgrep raw output, Tree-sitter artifacts, findings, published comment metadata, and any existing artifact classes according to docs/PRIVACY_RETENTION.md. Cleanup should be safe, idempotent, observable, and documented.

Add repository allowlist configuration so only configured installations/repositories are accepted for review when the allowlist is enabled. Rejected repositories should not enqueue jobs and should leave safe, minimal audit/debug information.

Testing requirements:
- Add retention config validation tests.
- Add cleanup tests for expired artifacts, non-expired artifacts, and idempotent repeated cleanup.
- Add repository allowlist tests for allowed, denied, disabled allowlist, and malformed config cases.
- Add webhook ingestion tests proving denied repositories do not enqueue jobs.

Acceptance criteria:
- Artifact retention policy is configurable.
- Cleanup behavior is defined and tested.
- Repository allowlist is supported for MVP webhook ingestion.
- Privacy and retention behavior follows docs/PRIVACY_RETENTION.md.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```

