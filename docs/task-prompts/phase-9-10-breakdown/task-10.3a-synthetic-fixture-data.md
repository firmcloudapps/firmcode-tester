# Task 10.3a: Synthetic End-To-End Fixture Data

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 10.3, docs/TASK_PROMPTS.md Task 10.3, docs/LOCAL_DEVELOPMENT.md, docs/LLM_STRATEGY.md, docs/LARGE_PR_HANDLING.md, docs/PRIVACY_RETENTION.md.
Code context requirement: Before implementing, inspect existing fixtures under apps/api, apps/worker, packages/shared, Semgrep fixtures, CI log fixtures, contract fixtures, and any dry-run or fake-client tests.

Create synthetic fixture data for a full dry-run PR review. The fixture must include a GitHub webhook payload, PR metadata, changed files/diffs, application code, infrastructure code, a Semgrep finding, Tree-sitter-supported code, and a CI failure log. Keep all data synthetic and safe to commit. The fixture should be deterministic and small enough for CI while still exercising the full review loop.

Use existing fixture directory conventions. Include expected output snapshots or golden files where useful: summary, inline comments, findings, stage artifacts, and CI explanation.

Testing requirements:
- Add fixture validation tests for webhook payload shape, changed file/diff consistency, and shared contract compatibility.
- Add Semgrep fixture test or expected finding assertion.
- Add CI log fixture test that produces the expected explanation shape.
- Add tests proving no real secrets or private repository names are present.

Acceptance criteria:
- Synthetic fixture covers application code, infrastructure code, Semgrep finding, and CI failure.
- Fixture data is deterministic, safe, and committed in existing fixture locations.
- Expected outputs are captured where useful for later dry-run tests.
- Fixture contracts validate against shared schemas.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```

