# Task 7.2: Inline Review Publisher

Implemented GitHub Reviews API inline publishing for changed-line findings.

Reference files read:

- `AGENTS.md`
- `docs/TASKS.md`
- `docs/REFERENCE_ANALYSIS.md`
- `docs/WEBHOOK_IDEMPOTENCY.md`
- `docs/LARGE_PR_HANDLING.md`
- `docs/LLM_STRATEGY.md`
- `pr-agent/pr_agent/git_providers/github_provider.py`

Implementation:

- Added a GitHub App inline review publisher that creates one PR review with batched line comments against the target head SHA.
- Enforced changed-line eligibility before building the GitHub review payload.
- Rendered inline comments with severity, confidence, evidence, and an actionable fix section.
- Applied the configured max inline comment cap after sorting by severity, confidence, then stable input order.
- Added published inline comment persistence through the existing `published_comments` table, including returned GitHub review comment IDs.
- Registered the review publisher in the GitHub webhook module for production configuration.

Tests:

- Added review payload formatting coverage for changed-line filtering and required comment sections.
- Added comment cap ordering coverage for severity and confidence ordering.
- Added a mocked GitHub Reviews API test that persists returned inline comment IDs.
