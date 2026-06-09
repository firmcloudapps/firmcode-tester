# Task 9.6a: Repository Detail Page

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.6, docs/TASK_PROMPTS.md Task 9.6, docs/PRD.md, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md.
Code context requirement: Before implementing, inspect repository list routes/actions, review run APIs, findings APIs, repository configuration APIs, dashboard tabs/components, authorization helpers, and tests.

Implement /repositories/:id as a InsForge-authenticated repository detail surface with Overview, Pull Requests, Findings, Configuration, and Activity tabs. The page must verify workspace ownership, show 404 or denied states for missing/cross-workspace repositories according to existing conventions, and keep configuration controls role-aware.

Repository Configure row actions must route to this implemented page. Lower roles should see read-only configuration where required by docs/AUTHORIZATION.md.

Testing requirements:
- Add API tests for repository detail, repository activity, cross-workspace denial, and missing repository.
- Add component tests for every tab, loading, empty, error, populated, and read-only role states.
- Add navigation tests proving repository Configure links do not 404.

Acceptance criteria:
- /repositories/:id is implemented and ownership-gated.
- Repository tabs expose the required data without raw sensitive artifacts unless authorized.
- Configuration controls respect role capabilities.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
