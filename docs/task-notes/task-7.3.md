# Task 7.3: Dry Run Mode

Implemented dry run mode for GitHub publishing boundaries.

## Changes

- Added `DRY_RUN` to typed API runtime config, defaulting to `true`.
- Added dry-run activity and inline review publishers that render and persist would-be summary and inline comments without creating installation tokens or calling GitHub write endpoints.
- Added structured dry-run logs for scanning, summary, and inline review publishing skips.
- Extended `published_comments` with `github_review_id`, `body`, and `dry_run` fields, plus an idempotent migration for existing databases.
- Added dashboard review-run detail data access at `GET /api/review-runs/:id`, including persisted dry-run outputs.

## Tests

- Publisher tests prove dry-run summary, scanning, and inline review paths make no `fetch` calls.
- Migration tests cover dry-run body persistence.
- Review-run store tests verify dashboard-facing dry-run output retrieval.
