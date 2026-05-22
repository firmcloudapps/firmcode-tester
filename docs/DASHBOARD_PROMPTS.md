# Dashboard Design Prompts

Use these prompts for dashboard planning, design, and frontend implementation tasks. Every prompt intentionally starts with the AGENTS guardrail to reduce drift.

## Dashboard Design System

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/PRD.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/TASKS.md, CLAUDE.md.
Acceptance/test criteria: Verify against docs/DASHBOARD_DESIGN.md with component tests for loading, empty, error, and populated states where applicable, plus responsive/accessibility/visual smoke checks; do not declare done until checks pass or any inability to run them is documented.
Read docs/DASHBOARD_DESIGN.md, docs/PRD.md, docs/TASKS.md, CLAUDE.md, and docs/REFERENCE_ANALYSIS.md. Design the Firmcode dashboard visual system for a clean modern light-mode code review SaaS. Use Next.js, TypeScript, and Tailwind CSS. Define Tailwind theme tokens, layout primitives, typography, status colors, severity badges, cards, tables, tabs, drawers, tooltips, buttons, form controls, code snippets, and empty/loading/error states. Clerk owns authentication and billing UI entry points, and NeonDB/PostgreSQL backs application data. Do not build a landing page. Produce implementation-ready component notes and acceptance criteria.
```

## Dashboard App Shell

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/PRD.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/TASKS.md, CLAUDE.md.
Acceptance/test criteria: Verify against docs/DASHBOARD_DESIGN.md with component tests for loading, empty, error, and populated states where applicable, plus responsive/accessibility/visual smoke checks; do not declare done until checks pass or any inability to run them is documented.
Build the Firmcode dashboard app shell following docs/DASHBOARD_DESIGN.md. Implement a light-mode SaaS layout with top bar, workspace switcher, global search placeholder, GitHub connect action, notifications placeholder, Clerk user menu area, and left sidebar navigation for Overview, Repositories, Pull Requests, Review Runs, Findings, CI Failures, Rules / Policies, Settings, and Billing. Use TypeScript and Tailwind CSS. Make the shell responsive with a mobile sidebar drawer. Include accessible navigation states, active route styling, loading states, and component tests.
```

## Overview Page

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/PRD.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/TASKS.md, CLAUDE.md.
Acceptance/test criteria: Verify against docs/DASHBOARD_DESIGN.md with component tests for loading, empty, error, and populated states where applicable, plus responsive/accessibility/visual smoke checks; do not declare done until checks pass or any inability to run them is documented.
Build the Firmcode Overview dashboard page following docs/DASHBOARD_DESIGN.md. Include metric cards for review activity, security findings, CI failures explained, and repositories monitored. Add a Recent Review Runs table and a Needs Attention panel for failed jobs, high-severity findings, CI failures, and incomplete repository configuration. Use typed mock data or shared DTOs if APIs are not ready. Use Tailwind CSS, compact light-mode styling, responsive layout, accessible status labels, and tests for loading, empty, error, and populated states.
```

## Repositories Page

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/PRD.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/TASKS.md, CLAUDE.md.
Acceptance/test criteria: Verify against docs/DASHBOARD_DESIGN.md with component tests for loading, empty, error, and populated states where applicable, plus responsive/accessibility/visual smoke checks; do not declare done until checks pass or any inability to run them is documented.
Build the Firmcode Repositories page following docs/DASHBOARD_DESIGN.md. Include header actions for Sync GitHub and Connect GitHub App, filters for enabled/disabled/private/public/language, and a repository table with repository name, default branch, visibility, review automation status, last PR reviewed, last run status, open findings, and actions. Add row actions for enable/disable, configure, view runs, and sync. Use TypeScript, Tailwind CSS, typed DTOs, Clerk-authenticated access, and tests for loading, empty, error, and populated states.
```

## Repository Detail

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/PRD.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/TASKS.md, CLAUDE.md.
Acceptance/test criteria: Verify against docs/DASHBOARD_DESIGN.md with component tests for loading, empty, error, and populated states where applicable, plus responsive/accessibility/visual smoke checks; do not declare done until checks pass or any inability to run them is documented.
Build the Firmcode Repository Detail page following docs/DASHBOARD_DESIGN.md. Include tabs for Overview, Pull Requests, Findings, Configuration, and Activity. Configuration must include auto-review enabled, draft PR behavior, max inline comments, review severity threshold, Semgrep enabled, Tree-sitter parsing enabled, CI failure explanation enabled, infrastructure review enabled, and dry-run mode. Use accessible tabs and form controls, TypeScript, Tailwind CSS, typed DTOs, and validation/error states.
```

## Pull Requests Page

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/PRD.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/TASKS.md, CLAUDE.md.
Acceptance/test criteria: Verify against docs/DASHBOARD_DESIGN.md with component tests for loading, empty, error, and populated states where applicable, plus responsive/accessibility/visual smoke checks; do not declare done until checks pass or any inability to run them is documented.
Build the Firmcode Pull Requests page following docs/DASHBOARD_DESIGN.md. Create an engineering queue with filters for repository, status, risk level, review status, author, and date range. The table should show PR title, repository, author, risk, review status, findings, CI status, and updated time. Include a PR detail layout with summary, changed components, risk analysis, review timeline, findings list, metadata panel, branches, commit SHA, files changed, review duration, and GitHub link. Use TypeScript, Tailwind CSS, typed data, and tests for core states.
```

## Review Runs Page

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/PRD.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/TASKS.md, CLAUDE.md.
Acceptance/test criteria: Verify against docs/DASHBOARD_DESIGN.md with component tests for loading, empty, error, and populated states where applicable, plus responsive/accessibility/visual smoke checks; do not declare done until checks pass or any inability to run them is documented.
Build the Firmcode Review Runs list and detail pages following docs/DASHBOARD_DESIGN.md. The list should filter by repository, status, trigger, date range, and risk. The detail page should show run status, repository, PR, commit SHA, duration, files analyzed, Semgrep findings, AI findings, inline comments posted, token usage or estimated cost, and a pipeline visualization for Webhook Received, Diff Fetched, Tree-sitter Parsed, Semgrep Scanned, LLM Reviewed, and Comments Published. Each stage needs status, duration, error message, and artifact link. Use TypeScript, Tailwind CSS, accessible status rendering, and tests.
```

## Findings Page

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/PRD.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/TASKS.md, CLAUDE.md.
Acceptance/test criteria: Verify against docs/DASHBOARD_DESIGN.md with component tests for loading, empty, error, and populated states where applicable, plus responsive/accessibility/visual smoke checks; do not declare done until checks pass or any inability to run them is documented.
Build the Firmcode Findings inbox following docs/DASHBOARD_DESIGN.md. Include filters for severity, source, category, repository, status, posted inline, and date. Render findings in a scan-friendly table or list with severity, source, category, file, line, confidence, posted status, and timestamps. Add a detail drawer with title, explanation, evidence, file path and line, Semgrep rule ID when available, suggested fix, review run link, and GitHub comment link. Support statuses: Open, Posted, Suppressed, Resolved, and False positive. Use TypeScript, Tailwind CSS, typed DTOs, and tests.
```

## CI Failures Page

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/PRD.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/TASKS.md, CLAUDE.md.
Acceptance/test criteria: Verify against docs/DASHBOARD_DESIGN.md with component tests for loading, empty, error, and populated states where applicable, plus responsive/accessibility/visual smoke checks; do not declare done until checks pass or any inability to run them is documented.
Build the Firmcode CI Failures page following docs/DASHBOARD_DESIGN.md. Show repository, PR, failed workflow/job, root cause summary, flaky suspected status, suggested fix, and created time. The detail view should include failure summary, likely root cause, suggested fixes, failed jobs, and collapsed redacted log excerpts. Use TypeScript, Tailwind CSS, monospace log panels, accessible status labels, and tests for loading, empty, error, and populated states.
```

## Rules And Policies Page

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/PRD.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/TASKS.md, CLAUDE.md.
Acceptance/test criteria: Verify against docs/DASHBOARD_DESIGN.md with component tests for loading, empty, error, and populated states where applicable, plus responsive/accessibility/visual smoke checks; do not declare done until checks pass or any inability to run them is documented.
Build the Firmcode Rules / Policies page following docs/DASHBOARD_DESIGN.md. Include sections for review preferences, security rules, infrastructure rules, comment policy, prompt instructions, and ignored paths. Add controls for severity threshold, max comments per PR, category enablement, custom review instructions, ignored paths, generated file ignore patterns, and Semgrep rule config. Use TypeScript, Tailwind CSS, accessible forms, validation states, unsaved-change handling, and tests.
```

## Settings And Billing

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/PRD.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/TASKS.md, CLAUDE.md.
Acceptance/test criteria: Verify against docs/DASHBOARD_DESIGN.md with component tests for loading, empty, error, and populated states where applicable, plus responsive/accessibility/visual smoke checks; do not declare done until checks pass or any inability to run them is documented.
Build the Firmcode Settings and Billing shells following docs/DASHBOARD_DESIGN.md. Settings should include General, GitHub App, Members, API Keys, Data Retention, and Notifications tabs. Clerk owns identity and member management where possible. Billing should show current plan, monthly usage, review runs, AI tokens, repositories, seats, and a Manage Subscription action through Clerk Billing. Use TypeScript, Tailwind CSS, Clerk-gated access, NeonDB-backed settings data, and tests.
```

## Dashboard Visual QA

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/PRD.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md, docs/TASKS.md, CLAUDE.md.
Acceptance/test criteria: Verify against docs/DASHBOARD_DESIGN.md with component tests for loading, empty, error, and populated states where applicable, plus responsive/accessibility/visual smoke checks; do not declare done until checks pass or any inability to run them is documented.
Perform visual QA for the Firmcode dashboard implementation against docs/DASHBOARD_DESIGN.md. Verify light-mode styling, responsive desktop/mobile layouts, no text overflow, usable tables, accessible status labels, coherent spacing, consistent Tailwind tokens, empty/loading/error states, Clerk-authenticated navigation, Billing entry point, and no landing-page hero treatment. Use screenshots or browser checks where available. Report findings with file paths, severity, and concrete fixes.
```

