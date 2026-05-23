# Task 9.3b: Findings Inbox

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.3, docs/TASK_PROMPTS.md Task 9.3, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md, docs/PRD.md.
Code context requirement: Before implementing, inspect existing findings data models, review run detail findings UI, API stores, dashboard filters, tests, and shared contracts before adding new types.

Build or complete the Findings inbox page. It must support filters for severity, source, category, repository, status, posted inline, and date. Render findings in a scan-friendly table or list with severity, source, category, file, line, confidence, posted status, timestamps, and links to the related review run or GitHub comment when available. Add a detail drawer or detail panel if the existing design patterns support it.

Use real API-backed data if endpoints exist. If API work is not ready, use typed mock data or fixtures with a clear replacement boundary. Keep raw artifact access out of this task unless an authorized artifact link already exists.

Testing requirements:
- Add component tests for loading, empty, error, and populated findings states.
- Add filter interaction tests for severity, source, category, repository, status, posted inline, and date.
- Add tests for detail drawer/panel rendering with evidence, suggested fix, Semgrep rule ID, and links where present.
- Add or document a desktop/mobile visual smoke check.

Acceptance criteria:
- Findings page supports all planned filters.
- Findings are rendered with actionable metadata and accessible severity/status labels.
- Page follows docs/DASHBOARD_DESIGN.md light-mode style.
- TypeScript data shapes align with shared DTOs or typed fixtures.
- Tests and visual smoke checks pass, or inability to run them is documented with exact commands.
```

