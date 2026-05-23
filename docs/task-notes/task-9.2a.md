# Task 9.2a: Review Run Retry API

Implemented `POST /api/review-runs/:id/retry` for dashboard retry actions.

Notes:

- The endpoint requires `x-firmcode-user-id` and `x-firmcode-workspace-id` headers until the broader Clerk guard foundation is wired.
- Workspace membership is checked through `workspace_memberships`; owner, admin, and developer roles can retry, while viewer cannot.
- Resource ownership is enforced by joining review runs through repositories and GitHub installations scoped to `github_installations.workspace_id`.
- Failed runs are retryable unless the failure code is a deterministic validation/configuration failure such as `invalid_job_payload`, `unsupported_job_name`, `github_response_invalid`, `review_context_not_found`, or `missing_worker_env`.
- Retry state is persisted in `review_run_retries` with a stable `retry:<original_run_id>` delivery/job id so duplicate retry attempts return the existing retry without creating another job.
- The endpoint only schedules queue work; it does not publish GitHub comments.

Verification:

- `npm run test`
