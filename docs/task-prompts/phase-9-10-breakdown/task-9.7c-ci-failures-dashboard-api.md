# Task 9.7c: CI Failures Dashboard API

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.7, docs/TASK_PROMPTS.md Task 9.7, docs/PRD.md, docs/AUTHORIZATION.md, docs/LLM_STRATEGY.md, docs/PRIVACY_RETENTION.md.
Code context requirement: Before implementing, inspect CI log/check run ingestion, CI failure explanation artifacts, review run artifacts, repository ownership checks, dashboard DTOs, raw/redacted artifact policies, and tests.

Implement dashboard APIs for CI failure list and detail views. The list should expose repository, PR, failed workflow/job, root cause summary, flaky suspected status, suggested fix, status, and created time. Detail should include root cause, suggested fixes, failed jobs, related review run/artifact links, and collapsed redacted log excerpts.

Raw CI logs and raw artifacts must remain governed by docs/PRIVACY_RETENTION.md and docs/AUTHORIZATION.md. Lower roles may receive redacted summaries when allowed, but not raw sensitive artifacts.

Testing requirements:
- Add API tests for CI failure list, filters, detail, redacted log excerpts, missing failure, malformed filters, ownership denial, and cross-workspace denial.
- Add raw artifact denial tests for non-elevated roles if detail links can reach raw logs.
- Add tests proving raw logs are not returned by default list/detail endpoints.

Acceptance criteria:
- CI failure APIs are implemented and ownership-gated.
- Detail responses use redacted excerpts by default.
- Raw artifacts remain separately role-gated.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
