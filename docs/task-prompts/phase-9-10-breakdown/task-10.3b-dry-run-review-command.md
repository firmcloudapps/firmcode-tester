# Task 10.3b: Dry-Run Review Command

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 10.3, docs/TASK_PROMPTS.md Task 10.3, docs/LOCAL_DEVELOPMENT.md, docs/RELEASE_CHECKLIST.md, docs/DEPLOYMENT.md, docs/LLM_STRATEGY.md.
Code context requirement: Before implementing, inspect existing package scripts, worker entry points, API test harnesses, fake GitHub/LLM clients, Docker Compose, and fixture helpers before adding a new command.

Create one documented command that runs the synthetic PR review fixture end to end in dry-run mode. It should start from the webhook fixture or an equivalent local entry point and produce generated summary, inline comments, findings, and artifacts without posting to GitHub. Use fake or local adapters for GitHub publishing and LLM output where needed for deterministic CI behavior.

The command should be easy to run locally through npm, Python, or Docker Compose according to existing repo conventions. It should fail non-zero when required outputs are missing or invalid.

Testing requirements:
- Add a smoke test that invokes the dry-run command or its core runner against the synthetic fixture.
- Add assertions that summary, inline comments, findings, and artifacts are produced.
- Add assertions that GitHub posting is disabled or mocked.
- Add docs or script tests proving the command is discoverable from package scripts or local development docs.

Acceptance criteria:
- One command runs the full dry-run review.
- Dry-run output includes summary, inline comments, findings, and artifacts.
- The run is deterministic and does not call real GitHub publishing.
- The command is documented for local use.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```

