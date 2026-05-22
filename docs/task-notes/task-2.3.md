# Task 2.3 Implementation Notes

## Planning Docs Applied

- `AGENTS.md`
- `docs/TASKS.md`
- `docs/LARGE_PR_HANDLING.md`
- `docs/REFERENCE_ANALYSIS.md`
- `docs/LLM_STRATEGY.md`
- `docs/PRD.md`

## Reference Repository Notes

- Read `pr-agent/pr_agent/algo/file_filter.py` for path-filtering structure and glob/regex separation.
- Read `semgrep/src/targeting/Filter_target.ml` for target filtering precedence ideas.
- Read `pr-agent/pr_agent/algo/types.py` for the changed-file artifact shape.

No code was imported from or written into `pr-agent/`, `semgrep/`, or `tree-sitter/`. The Firmcode implementation uses owned TypeScript classifiers, contracts, and tests.

## Risk Classification Shape

- `packages/shared/src/risk/changed-file-risk.ts` classifies changed files from path, previous path, patch, and content signals.
- Risk flags cover auth, secrets, database migrations, dependency files, infrastructure files, public API surface, and CI workflows.
- Content classification prefers added diff lines when patch text is available, so unchanged head-file secrets do not become changed-risk signals.
- `ReviewContextPack` and `ReviewContextFile` now include per-file risk metadata for future context packing.
- `GitHubPullRequestFileFetcher` attaches risk metadata to fetched and skipped changed-file artifacts so future persistence can store `risk_flags_json` directly.

## Tests

- Added path and content classifier unit tests.
- Added a mixed application and infrastructure PR fixture test through the unified diff parser.
- Added API fetcher coverage proving risk metadata is attached to fetched and skipped changed files.
