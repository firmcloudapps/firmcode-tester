# Task 11.5: Dashboard And Operations For Codebase Scans

Relevant planning docs: docs/TASKS.md Task 11.5, docs/PRD.md sections 6, 10, and 16, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md, docs/OPERATIONS_RUNBOOK.md, docs/PRIVACY_RETENTION.md.
Code context requirement: Before implementing, inspect repository list/detail UI, findings inbox, review run detail, rules/policies UI, dashboard API stores, authorization helpers, and existing component/API tests.

Expose codebase scan state, findings, controls, and operations guidance in the dashboard and runbooks.

Implementation requirements:

- Add dashboard APIs for repository scan run list/detail, open scan findings, manual scan enqueue, and finding status updates.
- Show latest scan status, last scan time, open finding count, and manual scan action on repository list/detail.
- Extend findings inbox filters to include PR findings and codebase scan findings with repository, severity, source, category, status, and date filters.
- Add repository scan configuration for cadence, enabled state, ignored paths, severity threshold, max files, and max bytes.
- Enforce role permissions: Developers and Admins can configure repository scans, trigger scans, and suppress/mark findings false positive where workspace policy and plan limits allow. Admins retain global policy and support/safety controls.
- Update operations docs for scan backlog, GitHub rate limits, scan failures, Semgrep timeouts, stale findings, retention cleanup, and manual recovery.

Acceptance criteria:

- Dashboard surfaces do not expose active controls for unauthorized users.
- Manual scan controls show loading, success, failure, and duplicate-job states.
- Findings status changes are auditable and tenant-safe.
- Repository scan configuration changes are persisted and reflected in scheduling behavior.
- Operations docs include concrete commands or dashboard steps for scan-related incidents.

Suggested tests:

- Dashboard API tests for scan run list/detail, findings filter, manual scan, and finding status updates.
- Component tests for repository scan status, manual scan button states, findings filters, and role-gated actions.
- Authorization tests for cross-workspace access and insufficient roles.
- Documentation/readiness check for scan operations guidance.
