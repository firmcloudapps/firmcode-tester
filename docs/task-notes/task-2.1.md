# Task 2.1 Implementation Notes

## Planning Docs Applied

- `AGENTS.md`
- `docs/TASKS.md`
- `docs/REFERENCE_ANALYSIS.md`
- `docs/LARGE_PR_HANDLING.md`
- `docs/PRIVACY_RETENTION.md`
- `docs/PRD.md`

## Reference Repository Notes

- Read `pr-agent/pr_agent/git_providers/github_provider.py` for the provider boundary, pagination handling, retry posture, and canonical changed-file assembly pattern.
- Read `pr-agent/pr_agent/git_providers/git_provider.py` for the abstract provider shape.
- Read `pr-agent/pr_agent/algo/types.py` for the `FilePatchInfo` changed-file artifact concept.
- Read `pr-agent/pr_agent/algo/file_filter.py` for skip/filtering behavior.

No code was imported from or written into `pr-agent/`, `semgrep/`, or `tree-sitter/`. The Firmcode implementation uses owned TypeScript interfaces, skip reasons, and tests.

## Adapter Shape

- `GitHubPullRequestFileFetcher` lives in API infrastructure and depends on a mockable `GitHubRestClient`.
- It fetches `/pulls/{pull_number}/files` with pagination, preserves patch/additions/deletions/status metadata, and fetches supported file contents from `/contents/{path}?ref={head_sha}`.
- Deleted, binary, unsupported, oversized, and unavailable-content files are returned in `skippedFiles` with explicit reasons and exclusion flags for Semgrep, Tree-sitter, and LLM context.
- Transient GitHub failures are retried for both pagination and content fetches.
