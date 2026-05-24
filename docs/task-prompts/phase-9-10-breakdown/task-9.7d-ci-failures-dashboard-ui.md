# Task 9.7d: CI Failures Dashboard UI

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.7, docs/TASK_PROMPTS.md Task 9.7, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md, docs/PRIVACY_RETENTION.md.
Code context requirement: Before implementing, inspect the dashboard shell, sidebar route definitions, overview needs-attention links, findings/detail UI patterns, code/log panel components, API clients, and tests.

Build /ci-failures and CI failure detail UI. The list should show repository, PR, failed workflow/job, root cause summary, flaky suspected status, suggested fix, and created time. Detail should show failure summary, likely root cause, suggested fixes, failed jobs, collapsed redacted log excerpts, and related review run/artifact links.

Do not display raw logs, raw prompts, raw model outputs, or raw Semgrep output unless the raw artifact endpoint confirms the role is allowed. Use redacted summaries/excerpts by default.

Testing requirements:
- Add component tests for loading, empty, error, populated, filter, detail, redacted log excerpt, and unauthorized raw artifact states.
- Add route/navigation tests proving CI Failures sidebar and overview links do not 404 once enabled.
- Add responsive visual smoke coverage or document the exact command that could not run.

Acceptance criteria:
- /ci-failures and CI failure detail views are implemented.
- Redacted excerpts are the default detail surface.
- Unauthorized raw artifact controls are hidden or disabled.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
