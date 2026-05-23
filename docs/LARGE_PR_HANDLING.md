# Large PR And File Handling

Firmcode should remain useful on large PRs without exhausting LLM budgets or posting noisy reviews.

## Large PR Triggers

Enter large-PR mode when any threshold is exceeded:

- changed files count
- total diff bytes
- total changed lines
- estimated prompt tokens
- file count after generated/vendor filtering
- Semgrep runtime budget

Thresholds should be configurable by workspace/repository and environment variables.

## Large PR Modes

### Normal Mode

All supported changed files are eligible for Semgrep, Tree-sitter, context packing, and inline comments.

### Prioritized Mode

Analyze high-risk files first:

- auth/security
- infrastructure
- dependencies
- migrations
- public API
- CI workflows
- files with Semgrep findings

Inline comments are limited to high-confidence/high-severity findings.

### Summary-Only Mode

Use when changed-line context is too large or unreliable. Produce:

- PR summary
- changed components
- skipped files and reasons
- risk analysis
- test recommendations
- deterministic Semgrep findings where valid

Do not post speculative inline comments.

## Generated And Vendor Files

Default skip candidates:

- `node_modules/`
- `vendor/`
- `dist/`
- `build/`
- `.next/`
- `coverage/`
- minified files such as `*.min.js`
- generated lock snapshots where review value is low
- generated API clients
- binary files
- large snapshots

Default special handling:

- dependency lockfiles are summarized and risk-flagged, not fully sent to LLM unless directly relevant.
- generated files should still be scanned for secrets if Semgrep configuration supports it.

## Skipped File Reporting

Every skipped file must include:

- path
- reason
- size when relevant
- whether it was excluded from Semgrep
- whether it was excluded from Tree-sitter
- whether it was excluded from LLM context

Skipped files should appear in review run artifacts and dashboard detail.

## Token Budgeting

Context packing priority:

1. Semgrep findings and surrounding changed lines.
2. Changed hunks in high-risk files.
3. Tree-sitter enclosing symbols/imports for changed hunks.
4. PR title/body and commit messages.
5. File list and skipped reasons.
6. Lower-risk changed hunks.

Syntax-aware context packing emits deterministic `context-chunks/v1` artifacts in the worker. Each chunk is built around one changed hunk, always keeps changed lines, adds the smallest enclosing Tree-sitter symbol plus imports when the configured character/token budget allows, and marks the chunk as truncated when full hunk or symbol scope had to be pruned.

## Tests

Fixtures should cover:

- huge diff
- many files
- lockfile-heavy PR
- generated file PR
- infrastructure-heavy PR
- large PR with one high-severity Semgrep finding
