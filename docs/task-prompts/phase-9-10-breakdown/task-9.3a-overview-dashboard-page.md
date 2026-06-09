# Task 9.3a: Overview Dashboard Page

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.3, docs/TASK_PROMPTS.md Task 9.3, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md, docs/PRD.md.
Code context requirement: Before implementing, inspect existing dashboard shell, overview route if present, shared review/repository DTOs, API modules, tests, Tailwind tokens, and InsForge-gated layout patterns.

Build or complete the Overview dashboard page. It should summarize review activity, security findings, CI failures, repositories monitored, recent review runs, and a needs-attention panel for failed jobs, high-severity findings, CI failures, and incomplete repository configuration. Prefer real API-backed data if endpoints exist; otherwise use typed mock data or local fixtures in a way that can be replaced cleanly.

Follow docs/DASHBOARD_DESIGN.md: compact light-mode SaaS layout, scan-friendly tables/panels, responsive behavior, accessible status labels, no marketing hero page, and no feature-explainer copy in the UI.

Testing requirements:
- Add component tests for loading, empty, error, and populated Overview states.
- Add tests for formatting status, severity, counts, and recent review run links.
- Add InsForge-authenticated access coverage if the route is gated at this layer.
- Add or document a desktop/mobile visual smoke check.

Acceptance criteria:
- Overview includes all required metric areas and needs-attention content.
- The page uses TypeScript, Tailwind CSS, and existing dashboard layout patterns.
- Data shapes are typed and compatible with shared DTOs or local typed fixtures.
- UI follows the approved light-mode dashboard design.
- Tests and visual smoke checks pass, or inability to run them is documented with exact commands.
```

