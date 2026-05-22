# Task 4.1 Notes

Implemented the Python worker Semgrep process wrapper as Firmcode-owned code.

Reference files read:

- `semgrep/cli/src/semgrep/run_scan.py`
- `semgrep/cli/src/semgrep/target_manager.py`
- `semgrep/cli/src/semgrep/formatter/json.py`
- `semgrep/cli/src/semgrep/semgrep_interfaces/semgrep_output_v1.jsonschema`
- `semgrep/src/osemgrep/cli_scan/Diff_scan.ml`

Planning docs applied:

- `docs/REFERENCE_ANALYSIS.md`
- `docs/LARGE_PR_HANDLING.md`
- `docs/OPERATIONS_RUNBOOK.md`
- `docs/ENVIRONMENT.md`
- `docs/TASKS.md`

Implementation:

- Added `firmcode_worker.semgrep.runner` for `semgrep scan --json` execution, configurable `SEMGREP_TIMEOUT_MS`, stderr/stdout capture, timeout handling, exit code preservation, and duration metrics.
- Added `firmcode_worker.semgrep.normalizer` to map Semgrep `results`, `errors`, and `paths` into the existing `semgrep-artifact/v1` worker contract.
- Raw Semgrep stdout/stderr/process metadata is written as a `semgrep-raw-output/v1` JSON artifact when an artifact directory is provided.

Tests:

- Added unit coverage for JSON normalization and process failure normalization.
- Added a process-wrapper test that scans a small Python fixture with a local Semgrep rule and verifies the normalized artifact plus raw-output artifact.

No reference source was imported or modified.
