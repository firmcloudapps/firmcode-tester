# Task 10.1b: Metrics And Stage Duration Tracking

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 10.1, docs/TASK_PROMPTS.md Task 10.1, docs/OPERATIONS_RUNBOOK.md, docs/DEPLOYMENT.md, docs/PRD.md.
Code context requirement: Before implementing, inspect existing review stage models, worker pipeline stages, analysis artifact storage, review run status updates, dashboard run detail UI, and tests.

Add lightweight metrics and stage duration tracking across the review pipeline. Track start time, end time, duration, status, and failure reason for key stages: webhook received, diff fetched, Tree-sitter parsed, Semgrep scanned, LLM reviewed, CI analyzed, comments published, and any queue wait/runtime metrics already represented in the codebase.

Expose the metrics in the safest existing surface: persisted review run stage records, artifacts, structured logs, or a typed dashboard detail response. Keep the implementation provider-neutral; do not add a heavy metrics stack unless the repo already uses one.

Testing requirements:
- Add unit tests for stage timing helpers or status transitions.
- Add worker/API tests that verify stage duration is recorded for successful and failed stages.
- Add tests for queue/job duration or retry metadata if the codebase exposes it.
- Add dashboard DTO tests if stage metrics are returned to the web app.

Acceptance criteria:
- Logs or persisted data include stage duration and failure reason.
- Review run details can surface stage status and duration.
- Failed stages record safe error codes/messages.
- Metrics are typed and do not include sensitive raw content.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```

