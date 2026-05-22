# Task 2.4 Implementation Notes

## Planning Docs Applied

- `AGENTS.md`
- `docs/TASKS.md`
- `docs/LARGE_PR_HANDLING.md`
- `docs/LLM_STRATEGY.md`
- `docs/PRIVACY_RETENTION.md`
- `docs/REFERENCE_ANALYSIS.md`

## Reference Repository Notes

- Read `pr-agent/pr_agent/algo/file_filter.py` and `pr-agent/pr_agent/settings/generated_code_ignore.toml` for generated-code and ignore-pattern structure.
- Read `pr-agent/pr_agent/algo/pr_processing.py` and `pr-agent/pr_agent/algo/token_handler.py` for token-budget and large-diff fallback behavior.
- Read `semgrep/src/targeting/Filter_target.ml` and `semgrep/cli/src/semgrep/target_manager.py` for target filtering precedence and skipped-path reason reporting.

No code was imported from or written into `pr-agent/`, `semgrep/`, or `tree-sitter/`. The implementation uses Firmcode-owned TypeScript contracts, classifiers, planner logic, and tests.

## Implementation Shape

- Added `createLargePullRequestReviewArtifact` in `packages/shared/src/review/large-pr-handling.ts`.
- Large-PR mode can be triggered by changed files, diff bytes, changed lines, estimated tokens, filtered-file count, or Semgrep runtime thresholds.
- Summary-only mode is selected when diff bytes, changed lines, or estimated tokens exceed the summary-only thresholds.
- Generated, vendor/build output, minified, dependency lockfiles, large snapshots, and binary files are reported with explicit reasons and exclusion flags.
- Prioritized mode sorts auth/secrets/migrations/infra/dependencies/public API/CI files ahead of lower-risk files and elevates files with Semgrep findings.
- `GitHubPullRequestFileFetcher` now returns a `largePullRequest` artifact and skips low-value generated-style files before content fetch while preserving Semgrep eligibility where appropriate.
- `ReviewContextPack` can carry the large-PR artifact and skipped-file reports for later persistence/dashboard display.

## Config

- Added environment-driven thresholds under `review.largePullRequest`:
  `REVIEW_LARGE_PR_MAX_CHANGED_FILES`, `REVIEW_LARGE_PR_MAX_DIFF_BYTES`, `REVIEW_LARGE_PR_MAX_CHANGED_LINES`, `REVIEW_LARGE_PR_MAX_ESTIMATED_TOKENS`, `REVIEW_LARGE_PR_MAX_FILTERED_FILES`, `REVIEW_LARGE_PR_MAX_SEMGREP_RUNTIME_MS`, `REVIEW_LARGE_PR_MAX_FULL_CONTEXT_FILES`, `REVIEW_SUMMARY_ONLY_DIFF_BYTES`, `REVIEW_SUMMARY_ONLY_CHANGED_LINES`, and `REVIEW_SUMMARY_ONLY_ESTIMATED_TOKENS`.

## Tests

- Added shared planner tests for huge diffs, many files, lockfile/generated/minified/binary handling, Semgrep-finding prioritization, and Semgrep runtime threshold triggers.
- Added API fetcher tests for generated/minified pre-content skipping and configurable large-PR artifact creation.
