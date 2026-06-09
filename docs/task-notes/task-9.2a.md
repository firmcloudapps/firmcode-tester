# Task 9.2a: Review Run Retry API

Implemented `POST /api/review-runs/:id/retry` for dashboard retry actions.

Notes:

- The endpoint is now behind the shared InsForge dashboard auth guard. User identity comes from the verified InsForge token; `x-firmcode-user-id` is rejected and `x-firmcode-workspace-id` is only an optional selector after membership verification.
- Workspace membership is checked through `workspace_memberships`; owner, admin, and developer roles can retry, while viewer cannot.
- Resource ownership is enforced by joining review runs through repositories and GitHub installations scoped to `github_installations.workspace_id`.
- Failed runs are retryable unless the failure code is a deterministic validation/configuration failure such as `invalid_job_payload`, `unsupported_job_name`, `github_response_invalid`, `review_context_not_found`, or `missing_worker_env`.
- Retry state is persisted in `review_run_retries` with a stable `retry:<original_run_id>` delivery/job id so duplicate retry attempts return the existing retry without creating another job.
- The endpoint only schedules queue work; it does not publish GitHub comments.

Verification:

- `npm run test`
