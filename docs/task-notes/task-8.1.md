# Task 8.1: Check Run And Workflow Run Fetching

Implemented failed check-run and GitHub Actions log fetching for PR head SHAs.

## Planning Docs Applied

- `AGENTS.md`
- `docs/TASKS.md`
- `docs/PRIVACY_RETENTION.md`
- `docs/LLM_STRATEGY.md`
- `docs/REFERENCE_ANALYSIS.md`
- `docs/OPERATIONS_RUNBOOK.md`

## Reference Repository Notes

- Read `pr-agent/pr_agent/git_providers/github_provider.py` for the provider boundary and GitHub-specific adapter posture.
- Read `pr-agent/pr_agent/git_providers/git_provider.py` for the provider abstraction shape.
- Read `pr-agent/pr_agent/servers/github_app.py` for the webhook-side distinction between PR events and failed check-run handling.

No code was imported from or written into `pr-agent/`, `semgrep/`, or `tree-sitter`. The Firmcode implementation uses owned TypeScript interfaces, shared contracts, and tests.

## Implementation

- Added `GitHubPullRequestCiLogFetcher` beside the existing GitHub infrastructure adapters.
- Fetches failed check runs for a head SHA from GitHub's check-runs endpoint.
- Resolves GitHub Actions job IDs from check-run URLs or workflow-run job listings.
- Fetches Actions job logs when permissions are available.
- Records unavailable checks/logs with stable reasons such as `missing_checks_permission`, `missing_actions_permission`, `not_github_actions`, `workflow_job_unavailable`, and `log_expired`.
- Redacts common token, password, key, bearer-token, GitHub token, AWS key, and private-key patterns before truncating.
- Truncates sanitized log content to `REVIEW_CI_LOG_MAX_BYTES` before storage or LLM context use.
- Added `ci-log-artifact/v1` to shared worker contracts and the Python contract model.

## Tests

- Added mocked GitHub check-run and Actions log tests.
- Added direct CI log redaction and truncation tests.
- Added shared/Python contract fixture coverage for `ci-log-artifact/v1`.
