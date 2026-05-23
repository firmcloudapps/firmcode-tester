# Task 8.2: CI Failure Explanation

Implemented deterministic CI failure explanation generation from normalized `ci-log-artifact/v1` check-run and log context.

## Planning Docs Applied

- `AGENTS.md`
- `docs/TASKS.md`
- `docs/LLM_STRATEGY.md`
- `docs/PRIVACY_RETENTION.md`
- `docs/DASHBOARD_DESIGN.md`
- `docs/REFERENCE_ANALYSIS.md`

## Reference Repository Notes

- Reviewed PR-Agent's GitHub provider publishing behavior for persistent summary comments and inline fallback posture.
- No CI-log explanation implementation was imported from reference repositories; Firmcode uses owned worker code, contracts, and fixtures.

## Implementation

- Added `ci-failure-explanation/v1` shared worker contract and Python contract model.
- Added worker CI explanation generation that groups failures by check-run job and GitHub Actions step.
- Classifies root-cause categories including tests, dependency/setup, lint, typecheck, build, timeout, cancellation, infrastructure, and unknown failures.
- Produces concise suggested fixes and a markdown string suitable for the existing summary `ciExplanation` section.
- Detects common flaky signals including explicit flaky/intermittent markers, timeouts, transient network/service errors, order/concurrency symptoms, and runner resource failures.
- Carries unavailable log notes forward so summaries can explain when some failed jobs could not be analyzed.

## Tests

- Added golden CI log input/expected fixtures for deterministic test failures and flaky timeout failures.
- Added flaky classifier tests for positive and deterministic-negative cases.
- Added shared and Python contract fixture coverage for `ci-failure-explanation/v1`.

## Verification

- `python3 -m pytest apps/worker/tests/test_ci_failure_explanation.py apps/worker/tests/test_contracts.py`
- `npm run test --workspace @firmcode/shared`
- `npm run test`
