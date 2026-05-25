# Task 11.4: Review Enrichment From Codebase Findings

Relevant planning docs: docs/TASKS.md Task 11.4, docs/PRD.md sections 13 and 16, docs/LLM_STRATEGY.md, docs/WEBHOOK_IDEMPOTENCY.md, docs/LARGE_PR_HANDLING.md.
Code context requirement: Before implementing, inspect the PR review worker summary renderer, findings persistence, pull request dashboard API, review output validation, Semgrep/LLM dedupe logic, and existing summary/comment tests.

Enrich PR review summaries with unresolved findings from recent codebase scans when those findings are relevant to the files or components touched by the PR.

Implementation requirements:

- Add a store query that loads unresolved codebase scan findings for changed file paths and touched components.
- Include high/critical unresolved repository findings from touched components even when they are not on changed lines.
- Keep inline review comments limited to current PR changed lines.
- Dedupe current PR findings against codebase scan findings by path, line, title, evidence hash, and source where available.
- Update the Code Review summary renderer to separate current PR findings from existing codebase findings when both are present.
- Include severity, path, evidence summary, and recommendation for codebase findings.
- Ensure superseded PR run protection still applies before publishing enriched summaries.

Acceptance criteria:

- PR summaries can mention relevant existing codebase issues without posting them as inline comments.
- Existing codebase issues are not duplicated when the same issue is found in the PR-specific scan.
- Code Review section remains concise and grounded in evidence.
- Summary text makes it clear whether an issue is new in the PR or pre-existing in the touched codebase area.

Suggested tests:

- Summary renderer tests for PR-only, codebase-only, and mixed findings.
- Deduplication tests between PR findings and codebase findings.
- Integration test from stored scan finding plus changed file to enriched GitHub summary body.
- Regression test that unrelated codebase findings are not included.
