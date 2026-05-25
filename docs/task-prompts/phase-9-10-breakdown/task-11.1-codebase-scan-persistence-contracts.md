# Task 11.1: Codebase Scan Persistence And Contracts

Relevant planning docs: docs/TASKS.md Task 11.1, docs/PRD.md sections 9, 10, 12, and 16, docs/PRIVACY_RETENTION.md, docs/AUTHORIZATION.md, docs/REFERENCE_ANALYSIS.md.
Code context requirement: Before implementing, inspect existing review run migrations, findings schema, shared worker contracts, Python contract models, repository stores, findings stores, and migration tests.

Add PR-independent persistence and versioned contracts for scheduled repository codebase scans. This task must not overload `review_runs`, because PR review runs are tied to pull requests and delivery IDs. Create owned scan concepts that can represent install-triggered, scheduled, manual, and push-triggered scans for a repository default branch.

Implementation requirements:

- Add migrations for `codebase_scan_runs` and `codebase_scan_findings`.
- Include repository ownership, installation linkage, trigger, default branch, commit SHA, status, timestamps, structured errors, metrics, stable dedupe keys, finding status, first/last seen, and resolved timestamps.
- Add indexes for repository scan history, open findings by repository/severity/status, dedupe, and file path lookup.
- Add shared TypeScript contracts and matching Python models for scan job input, scan run artifact metadata, normalized scan findings, and review-enrichment payloads.
- Reuse existing severity, category, confidence, source, evidence, and recommendation concepts where practical.
- Document retention and redaction expectations for scan artifacts and findings.

Acceptance criteria:

- Migrations are idempotent and pass the existing migration smoke pattern.
- Contracts have fixtures and validation tests in TypeScript and Python.
- Store tests cover scan run create/update, finding upsert by dedupe key, open finding query, and stale finding resolution after a successful scan.
- No GitHub tokens, OAuth tokens, private repository content, raw secrets, or unredacted prompts are persisted outside the approved artifact model.

Suggested tests:

- `npm run test --workspace @firmcode/api -- codebase-scan`
- `npm run test --workspace @firmcode/shared -- codebase-scan`
- `python3 -m pytest apps/worker/tests/test_contracts.py`
