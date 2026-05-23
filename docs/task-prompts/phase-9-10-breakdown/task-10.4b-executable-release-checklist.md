# Task 10.4b: Executable Release Checklist

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 10.4, docs/TASK_PROMPTS.md Task 10.4, docs/RELEASE_CHECKLIST.md, docs/DEPLOYMENT.md, docs/LOCAL_DEVELOPMENT.md, docs/ENVIRONMENT.md.
Code context requirement: Before implementing, inspect the release checklist, package scripts, Docker Compose services, deployment docs for Vercel/Coolify, environment docs, and existing smoke tests.

Make the release checklist executable for local or staging release. Convert vague checklist items into concrete commands, expected outputs, owners or runtime targets, and pass/fail criteria. Cover dependency install, lint, unit tests, integration tests, API/worker build, Next.js build, Docker image build, migrations, health/readiness, dry-run review fixture, Clerk auth/billing checks, GitHub App webhook checks, rollback, and post-release monitoring.

Do not require real production credentials for local checklist steps. Where staging credentials are required, mark the step clearly and reference environment variable docs.

Testing requirements:
- Verify documented commands exist or add missing package scripts where appropriate.
- Add or update a release smoke script if the repo already has script conventions for it.
- Add docs/checklist validation if available, or manually run the most relevant no-secret commands and record any inability.

Acceptance criteria:
- Release checklist is executable for local or staging release.
- Each step has command, expected result, and pass/fail guidance.
- Checklist covers dashboard, API, worker, Docker, database, Redis, Clerk, GitHub App, dry-run fixture, rollback, and monitoring.
- Commands match the current repo.
- Documentation checks or verified commands pass, or inability to run them is documented with exact command and failure.
```

