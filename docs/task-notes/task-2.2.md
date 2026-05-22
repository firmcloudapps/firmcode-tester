# Task 2.2 Implementation Notes

## Planning Docs Applied

- `AGENTS.md`
- `docs/TASKS.md`
- `docs/REFERENCE_ANALYSIS.md`
- `docs/LARGE_PR_HANDLING.md`
- `docs/PRD.md`

## Reference Repository Notes

- Read `pr-agent/pr_agent/algo/git_patch_processing.py` for hunk header parsing and line-number-aware patch handling patterns.
- Read `pr-agent/pr_agent/algo/types.py` for the file patch artifact shape used as reference context.

No code was imported from or written into `pr-agent/`, `semgrep/`, or `tree-sitter/`. The Firmcode implementation uses owned TypeScript interfaces, parser logic, and golden fixtures.

## Parser Shape

- `parseUnifiedDiff` lives in `packages/shared/src/diff/unified-diff.ts` so API publishing and later worker stages can share the same eligibility contract.
- It parses full unified diffs and bare GitHub file patch text when path metadata is supplied.
- Each parsed file records old/new paths, inferred status, hunks, per-line old/new mappings, and changed new-side lines.
- `canPostInlineGitHubComment` only allows findings on changed new-side lines for files that exist on the PR head side.
