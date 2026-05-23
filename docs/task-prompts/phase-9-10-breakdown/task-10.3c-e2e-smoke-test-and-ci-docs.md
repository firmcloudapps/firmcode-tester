# Task 10.3c: E2E Smoke Test And CI Docs

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 10.3, docs/TASK_PROMPTS.md Task 10.3, docs/LOCAL_DEVELOPMENT.md, docs/RELEASE_CHECKLIST.md, docs/DEPLOYMENT.md, docs/OPERATIONS_RUNBOOK.md.
Code context requirement: Before implementing, inspect existing CI scripts, package scripts, Docker Compose, local development docs, release checklist, and test organization before adding new workflow expectations.

Add an end-to-end smoke test suitable for CI/local execution using the synthetic dry-run fixture. The smoke test should exercise the same runner or command users will invoke locally and validate that the dry-run produces the expected summary, inline comments, findings, and artifacts.

Document how to run the smoke test locally, what dependencies it needs, how to interpret failures, and how it fits into the release checklist. Keep the smoke test bounded so it is useful in CI and does not require external network access or real credentials.

Testing requirements:
- Add or complete an E2E smoke test for the dry-run fixture.
- Add assertions for generated comments, findings, artifacts, Semgrep signal, and CI failure explanation.
- Add a failure-path assertion for missing fixture input or invalid output schema.
- Verify the documented command works or document any environment constraints.

Acceptance criteria:
- E2E dry-run smoke test can run in CI/local.
- Smoke test validates the core outputs, not just process exit.
- Documentation explains local execution and failure triage.
- No real GitHub, Clerk, LLM, or billing credentials are required.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```

