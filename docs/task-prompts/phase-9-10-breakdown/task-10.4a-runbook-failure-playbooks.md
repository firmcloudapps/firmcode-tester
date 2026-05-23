# Task 10.4a: Runbook Failure Playbooks

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 10.4, docs/TASK_PROMPTS.md Task 10.4, docs/OPERATIONS_RUNBOOK.md, docs/DEPLOYMENT.md, docs/ENVIRONMENT.md, docs/PRIVACY_RETENTION.md.
Code context requirement: Before implementing, inspect the current operations runbook, deployment docs, health/readiness endpoints, queue/job behavior, worker stages, and known error codes before editing documentation.

Finalize or expand operations runbook sections for failed jobs, GitHub rate limits, webhook failures, Semgrep timeouts, Tree-sitter failures, LLM failures, publishing failures, NeonDB issues, and Redis backlog. Each section should include symptoms, likely causes, safe diagnostic commands, what not to log or expose, immediate mitigation, retry guidance, escalation/rollback notes, and links to relevant local commands.

Keep documentation concrete and executable. Avoid vague instructions such as "check logs" unless accompanied by the exact service/log context and safe filters.

Testing requirements:
- Add or update documentation checks if the repo has them.
- Manually verify referenced commands exist in package scripts, Docker Compose, or docs; fix stale command names where found.
- Add a short runbook review note or checklist item for secret-safe diagnostics.

Acceptance criteria:
- Runbook covers all required failure modes from docs/TASKS.md Task 10.4.
- Each failure mode has actionable triage, mitigation, and retry guidance.
- Diagnostics avoid exposing secrets, private diffs, or full raw logs.
- Referenced commands and endpoints match the current repo.
- Documentation checks pass, or inability to run them is documented with exact command and failure.
```

