# Task 11.3: Worker Codebase Scan Pipeline

Relevant planning docs: docs/TASKS.md Task 11.3, docs/PRD.md sections 13, 14, 15, and 16, docs/LLM_STRATEGY.md, docs/PRIVACY_RETENTION.md, docs/LARGE_PR_HANDLING.md, docs/REFERENCE_ANALYSIS.md.
Code context requirement: Before implementing, inspect the deterministic PR pipeline, GitHub client, Semgrep runner/workspace, Tree-sitter extractor, review output validation, worker contracts, and existing pipeline tests.

Implement the Python worker pipeline that scans an enabled repository at its default branch and persists repository-level findings for later dashboard display and PR review enrichment.

Implementation requirements:

- Resolve the repository default branch and latest commit SHA using a GitHub App installation token.
- Skip the scan when the same repository commit SHA already has a successful scan.
- Build a bounded temporary checkout or file workspace using repository allowlists, ignored paths, generated-file handling, binary/oversized skipping, maximum file count, and maximum byte limits.
- Run Semgrep against supported code and infrastructure files and normalize findings.
- Run Tree-sitter extraction where supported to attach symbol and component context.
- Optionally call the LLM to produce concise bug/debug explanations and recommendations from deterministic evidence only.
- Redact secret-like evidence before persistence and before any model call.
- Persist scan artifacts, skipped-path accounting, metrics, normalized findings, and structured errors.
- Upsert findings by stable dedupe key and mark previously open findings resolved when absent from a successful scan.

Acceptance criteria:

- Successful scans produce a completed `codebase_scan_run`, artifacts, open findings, and metrics.
- Failed scans persist a failed scan run with safe error code/message and do not leak secrets.
- Stale findings are resolved only after a successful scan of the repository.
- Large repositories are bounded and produce skipped-path accounting instead of failing noisily.
- The pipeline is idempotent for the same repository and commit SHA.

Suggested tests:

- Unit tests for skip-if-same-SHA, workspace selection, ignored/generated/oversized paths, and stale finding resolution.
- Golden fixture test for a small repository that produces bug/security findings and recommendations.
- Failure tests for GitHub fetch errors, Semgrep process errors, Tree-sitter failures, LLM failures, and redaction.
- `python3 -m pytest apps/worker/tests`
