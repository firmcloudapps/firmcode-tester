# Task 5.1 Notes

Implemented the Python worker Tree-sitter parser registry as Firmcode-owned code.

Reference files read:

- `tree-sitter/docs/src/using-parsers/2-basic-parsing.md`
- `tree-sitter/docs/src/using-parsers/4-walking-trees.md`
- `docs/REFERENCE_ANALYSIS.md`

Planning docs applied:

- `docs/REFERENCE_ANALYSIS.md`
- `docs/LARGE_PR_HANDLING.md`
- `docs/ENVIRONMENT.md`
- `docs/OPERATIONS_RUNBOOK.md`
- `docs/TASKS.md`

Implementation:

- Added `firmcode_worker.tree_sitter.registry` with path and language hint resolution for JavaScript, TypeScript, Python, Go, Java, YAML, JSON, Dockerfile, Terraform, and HCL.
- Added lazy parser loading through configured parser package names and grammar factory symbols.
- Parser load results return explicit `available`, `failed`, or `unsupported` statuses.
- Unsupported paths and missing parser packages are reported as data results instead of raising through the review pipeline boundary.
- Supports TypeScript and TSX grammar symbols separately while keeping both resolved as the TypeScript language.
- Uses the HCL grammar package for both Terraform and HCL path mappings.

Tests:

- Added MVP path mapping tests, including extension, Dockerfile filename, Terraform, and HCL cases.
- Added unsupported path and language alias tests.
- Added parser load success and failure tests using injected fake Tree-sitter modules so the behavior is deterministic even when local grammar packages are absent.

Verification:

- `python3 -m pytest apps/worker/tests/test_tree_sitter_registry.py` passed with 24 tests.

No reference source was imported or modified.
