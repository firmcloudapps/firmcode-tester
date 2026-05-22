# Task 3.3 Notes

Implemented the first worker contract version set:

- `review-job-input/v1`
- `diff-artifact/v1`
- `semgrep-artifact/v1`
- `tree-sitter-artifact/v1`
- `llm-review-output/v1`
- `publish-payload/v1`

The shared TypeScript contract definitions and JSON Schemas live in `packages/shared/src/contracts/worker.ts`.
Compatibility fixtures live in `packages/shared/test/fixtures/worker-contracts`.
The Python worker mirrors the contracts with dataclass validators in `apps/worker/firmcode_worker/schemas/contracts.py`.

The API now enqueues `review.pull_request` jobs with `schemaVersion: "review-job-input/v1"`, and the worker rejects unsupported or malformed job payloads as `invalid_job_payload`.
