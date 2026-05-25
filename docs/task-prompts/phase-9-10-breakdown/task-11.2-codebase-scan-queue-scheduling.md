# Task 11.2: Codebase Scan Queue And Scheduling

Relevant planning docs: docs/TASKS.md Task 11.2, docs/PRD.md sections 10, 12, and 16, docs/WEBHOOK_IDEMPOTENCY.md, docs/AUTHORIZATION.md, docs/OPERATIONS_RUNBOOK.md.
Code context requirement: Before implementing, inspect GitHub installation sync, repository sync, repository automation configuration, review queue module, BullMQ queue wrapper, retry service, dashboard auth store, and API tests for sync/configuration.

Add queue and scheduling support for repository codebase scans. Scans should be created when repositories become available and should repeat on a configurable cadence without creating duplicate active work for the same repository/commit SHA.

Implementation requirements:

- Add a `codebase-scans` BullMQ queue or a typed job kind in the existing queue module if the local pattern strongly favors one queue.
- Enqueue initial scans when a GitHub App installation is connected, repositories are synced, or repository automation is enabled.
- Add repeatable scheduled scans for enabled repositories using a configurable default cadence.
- Add a manual scan API action for one repository after workspace membership and repository ownership checks.
- Ensure jobs include repository ID, installation ID, repository full name, default branch, trigger, and correlation ID.
- Deduplicate active jobs by repository ID and commit SHA where the commit SHA is already known, and by repository ID/trigger when it is not.
- Use GitHub App installation tokens for scan work. User OAuth tokens must never be used for repository content reads.

Acceptance criteria:

- Initial, scheduled, and manual scan paths create `queued` scan run records and enqueue exactly one scan job per intended repository.
- Repeated sync or repeated manual clicks do not create duplicate active jobs.
- Queue logs and metrics include scan run ID, repository, trigger, commit SHA when known, status, and duration.
- Failed enqueue attempts are structured and visible in repository scan status.

Suggested tests:

- API integration tests for installation sync to initial scan enqueue.
- Queue unit tests for repeatable schedule setup and dedupe.
- Authorization tests for manual scan endpoint.
- Repository automation tests proving enabling automation schedules a scan.
