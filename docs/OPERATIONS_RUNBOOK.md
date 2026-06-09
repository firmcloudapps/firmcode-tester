# Operations Runbook

This runbook covers common operational issues for Firmcode.

## Dashboard Authentication Failure

Symptoms:

- Dashboard redirects repeatedly between Firmcode and `/sign-in`.
- Signed-in users see a generic dashboard error.
- Protected API calls return `401`.
- GitHub OAuth start returns an auth/setup error.

Check:

- Vercel web env vars: `NEXT_PUBLIC_INSFORGE_BASE_URL`, `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `INSFORGE_BASE_URL`, `INSFORGE_ANON_KEY`, after-auth URLs, and `NEXT_PUBLIC_API_URL`.
- Coolify API env vars: `AUTH_PROVIDER=insforge`, `INSFORGE_BASE_URL`, `CORS_ALLOWED_ORIGINS`, and public API URL.
- InsForge allowed redirect URLs include the deployed Vercel domain and preview domain if used.
- The web route handler sends `Authorization: Bearer <InsForge access token>` to the API.
- The API auth guard validates the InsForge access token and resolves a workspace.

Action:

- Fix InsForge redirect/origin configuration before changing app code.
- If `/auth/redirect` returns to `/sign-in` after a successful login, confirm the web server can read `INSFORGE_BASE_URL` and `INSFORGE_ANON_KEY` for SSR session validation.
- Confirm server logs include a correlation ID and auth error class, but do not log token contents.
- Treat production fallback to `FIRMCODE_DASHBOARD_USER_ID` or `x-firmcode-user-id` as a security incident; remove the bypass and redeploy.
- If a dashboard API succeeds only when `FIRMCODE_DASHBOARD_*` or `x-firmcode-user-id` is present, roll back or disable the affected route. Those values are never production auth; only `NODE_ENV=test` controller tests may use legacy workspace/user shortcuts.
- For billing failures, inspect the resolved workspace role and InsForge billing capability claims. Do not accept a caller-provided billing capability header as proof.

## Workspace Or Role Mapping Failure

Symptoms:

- Signed-in users can authenticate but receive `403`.
- Signed-in users see an empty or wrong workspace.
- Admin controls are disabled for an expected admin.
- A user cannot connect GitHub OAuth because no workspace membership resolves.

Check:

- InsForge user/org claims for the user.
- Firmcode `workspaces` row for the InsForge organization or personal workspace.
- Firmcode `workspace_memberships` row for the InsForge user.
- Role mapping metadata if explicit Firmcode roles are configured in InsForge.

Action:

- Re-run the workspace/membership sync job or trigger request-time workspace resolution.
- For first-login failures, trigger the request-time workspace ensure path by signing out and back in.
- Correct role metadata in InsForge, then sign out and back in.
- Do not manually grant database roles in production unless the change is recorded as an audited break-glass action.

## Cross-Workspace Access Suspected

Symptoms:

- A user sees repositories, review runs, findings, artifacts, settings, or billing data from another workspace.
- API requests with a changed `workspaceId`, repository ID, or review run ID return data unexpectedly.

Action:

- Treat as a release blocker or security incident.
- Disable dashboard access or affected routes if necessary.
- Inspect API guard logs and resource ownership queries.
- Confirm list endpoints are scoped by resolved `workspace_id`.
- Confirm detail endpoints join through workspace-owned parents instead of trusting resource IDs.
- Add a regression test for the exact resource type before redeploying.

## Failed Review Job

Check:

- review run status and error code
- worker logs by correlation ID
- BullMQ job attempts
- GitHub API response
- Semgrep stderr artifact
- LLM provider response/error

Action:

- Retry if failure is transient.
- Mark failed if validation/configuration error.
- Use dry-run replay fixture when debugging publisher failures.

## GitHub Rate Limit

Symptoms:

- GitHub API returns rate-limit errors.
- Review jobs delayed or failing during file/log fetch.

Action:

- Respect reset headers.
- Delay retry with backoff.
- Reduce concurrency per installation.
- Avoid fetching full contents for low-priority files.

## CI Logs Unavailable

Symptoms:

- CI log artifact includes `missing_checks_permission`, `missing_actions_permission`, `workflow_job_unavailable`, `log_not_found`, or `log_expired`.
- Review summary has no CI explanation even though checks failed.

Action:

- Confirm the GitHub App has Checks read and Actions read permissions.
- Confirm the failed check run is a GitHub Actions check run; external CI systems may not expose logs through GitHub Actions APIs.
- For expired or deleted logs, rerun the workflow if a fresh explanation is needed.
- Keep redaction and truncation enabled before storing logs or sending CI excerpts to the LLM.

## Webhook Verification Failure

Check:

- `GITHUB_WEBHOOK_SECRET`
- raw request body handling
- proxy/tunnel body transformations
- GitHub delivery redelivery payload

Action:

- Do not process unverified payloads.
- Return `401`.
- Log delivery ID and event type only if safe.

## Semgrep Timeout

Check:

- file count and file sizes
- Semgrep config
- process timeout
- worker CPU/memory

Action:

- Retry once if transient.
- Enter partial result mode if safe.
- Record skipped/timeout artifacts.
- Consider large-PR prioritized mode.

## Codebase Scan Backlog

Symptoms:

- Repository detail shows queued/running codebase scans that do not advance.
- Findings are stale even though repository automation is enabled.

Check:

- Dashboard: open `/repositories/{repositoryId}?tab=scans` and confirm the latest scan status, trigger, commit SHA, and correlation ID in metrics.
- Redis/BullMQ: `docker compose exec redis redis-cli LLEN bull:codebase-scans:wait`
- Delayed jobs: `docker compose exec redis redis-cli ZCARD bull:codebase-scans:delayed`
- Failed jobs: `docker compose exec redis redis-cli ZCARD bull:codebase-scans:failed`

Action:

- Confirm the worker is healthy with `docker compose ps worker`.
- Reduce worker concurrency or scan cadence if one installation is flooding the queue.
- Queue one manual scan from the repository Scans tab after the backlog drains.

## Codebase Scan GitHub Rate Limit

Symptoms:

- Scan detail error code is `github_request_failed` or scan logs mention rate limit reset headers.
- Many repositories from one installation fail during tree or blob fetch.

Check:

- Dashboard: open the failed scan detail from `/repositories/{repositoryId}?tab=scans`.
- API/worker logs: `docker compose logs worker | grep codebase_scan`
- GitHub reset window from logs; do not log installation tokens.

Action:

- Wait until the GitHub reset time before retrying.
- Temporarily increase scan cadence hours or disable scans for low-priority repositories from repository configuration.
- Re-enable and manually scan the repository once the reset window passes.

## Codebase Scan Failure

Symptoms:

- Latest scan status is failed.
- Scan detail has `errorCode`, `errorMessage`, stage metrics, or missing artifacts.

Check:

- Dashboard: `/repositories/{repositoryId}?tab=scans`, then inspect the failed scan row and metrics.
- Worker logs by correlation ID: `docker compose logs worker | grep <correlationId>`
- Database status: `SELECT id, status, error_json, metrics_json FROM codebase_scan_runs WHERE repository_id = '<repository-id>' ORDER BY created_at DESC LIMIT 5;`

Action:

- Fix deterministic configuration errors before retrying.
- For transient GitHub, Redis, or Semgrep failures, click Scan now from the Scans tab.
- If a scan is stuck running after worker restart, mark it failed only after confirming no worker owns the job.

## Codebase Scan Semgrep Timeout

Symptoms:

- Scan error mentions Semgrep timeout or scan summary has large skipped/timeout counts.
- Worker CPU or memory is saturated during repository scans.

Check:

- Dashboard: open the repository Scans tab and compare selected file count, selected bytes, skipped paths, and Semgrep duration.
- Worker logs: `docker compose logs worker | grep semgrep`
- Repository scan configuration: cadence, ignored paths, severity threshold, max files, and max bytes.

Action:

- Add ignored paths for generated/vendor-heavy directories.
- Lower max files or max bytes for the repository and save configuration.
- Queue a manual scan from the Scans tab to verify the reduced scope.

## Stale Codebase Findings

Symptoms:

- Findings remain open after a successful scan where the issue should be gone.
- PR summaries mention resolved repository-level issues.

Check:

- Dashboard: filter Findings by Type = Codebase scan, repository, and Open status.
- Latest successful scan: `SELECT id, status, commit_sha, finished_at FROM codebase_scan_runs WHERE repository_id = '<repository-id>' ORDER BY created_at DESC LIMIT 5;`
- Finding state: `SELECT id, dedupe_key, status, first_seen_at, last_seen_at, resolved_at FROM codebase_scan_findings WHERE repository_id = '<repository-id>' ORDER BY last_seen_at DESC LIMIT 20;`

Action:

- Run a manual scan against the current default branch.
- Developers and Admins may mark known stale items resolved from the Findings inbox where workspace policy allows it.
- If stale resolution repeatedly misses findings, inspect dedupe key generation before bulk-updating rows.

## Codebase Scan Retention Cleanup

Symptoms:

- Scan artifacts exceed retention or storage grows unexpectedly.
- Resolved findings remain past the retention window.

Check:

- Dashboard: open the scan detail and confirm artifact retention metadata before cleanup.
- Candidate findings: `SELECT id, status, resolved_at FROM codebase_scan_findings WHERE status IN ('resolved', 'suppressed', 'false_positive') AND resolved_at < now() - interval '180 days';`

Action:

- Delete expired raw artifact objects according to their storage backend key and retention metadata.
- Run the documented retention cleanup job when available; until then, use a reviewed SQL maintenance script for metadata cleanup.
- Confirm dashboard scan detail still shows retained metadata and no raw repository contents.

## Codebase Scan Manual Recovery

Use when a repository needs a known-good scan after configuration or infrastructure recovery.

Steps:

- Dashboard: open `/repositories/{repositoryId}?tab=configuration` and confirm Review automation and Codebase scans are enabled.
- Save reduced ignored paths or scan limits if the previous failure was scope-related.
- Open `/repositories/{repositoryId}?tab=scans` and click Scan now.
- Confirm the button reports queued or duplicate-job state, then refresh until status is succeeded or failed.
- Verify Findings with Type = Codebase scan and the target repository.

## Worker Startup Semgrep Timeout

Symptoms:

- Worker logs repeat `worker.startup.completed` with `status="unavailable"`.
- The Semgrep dependency entry reports `error="TimeoutExpired"`.
- Redis and database dependency entries are `ok`.

Action:

- Confirm Coolify is deploying `docker-compose.prod.yml`.
- Pull the latest `obehiaye/firmcode-worker:latest` image and recreate the worker container.
- Confirm new startup logs include `semgrep_startup_probe="executable_only"`.
- Keep `SEMGREP_SEND_METRICS=off` in production.
- Leave full Semgrep execution to scan jobs; startup should only verify that the executable exists.

## Redis Memory Overcommit Warning

Symptoms:

- Redis logs `WARNING Memory overcommit must be enabled`.

Action:

- Set `vm.overcommit_memory=1` on the Coolify host, not inside application code.
- Persist the setting in `/etc/sysctl.conf` or `/etc/sysctl.d/*.conf`.
- Apply with `sysctl vm.overcommit_memory=1` or reboot during a maintenance window.

## Tree-sitter Parser Failure

Check:

- language mapping
- parser package availability
- file encoding
- file size threshold

Action:

- Mark file parse status as failed.
- Continue review without semantic context for that file.
- Add fixture if a supported language caused failure.

## LLM Provider Failure

Check:

- provider API key
- model name
- timeout
- rate limit
- invalid structured output

Action:

- Retry transient errors.
- Attempt one output repair for invalid JSON.
- Fall back to deterministic Semgrep-only output when configured.

## GitHub Comment Publishing Failure

Check:

- review run head SHA matches current PR head SHA
- inline comments map to changed lines
- GitHub App permissions
- comment body length
- secondary rate limit

Action:

- Skip publishing if run is superseded.
- Fall back invalid inline comments to summary-only.
- Persist failed publish payload for debugging.

## NeonDB Connection Issue

Check:

- `DATABASE_URL`
- SSL mode
- connection limit
- migration status
- Neon project health

Action:

- Reduce pool size for serverless-like environments.
- Retry transient connection failures.
- Fail readiness check until database is available.

## Redis Queue Backlog

Check:

- waiting/active/failed job counts
- worker replicas/concurrency
- poison jobs
- LLM/GitHub rate limits

Action:

- Pause queue if repeated poison job.
- Scale workers if safe.
- Lower per-repository concurrency when GitHub is rate-limiting.

## Vercel Web Deployment Failure

Check:

- Vercel project root points to `apps/web`.
- build command and output settings.
- `NEXT_PUBLIC_API_URL`.
- InsForge public base URL, anon key, and redirect URLs.
- API CORS allows the Vercel domain.
- preview deployment origin is allowed if using previews.

Action:

- Reproduce locally with the web build command.
- Confirm the Vercel deployment can reach the Coolify API health endpoint.
- Fix CORS or environment mismatch before retrying dashboard workflows.

## Coolify API/Worker Deployment Failure

Check:

- Dockerfile path and build context.
- service environment variables.
- health check path and port.
- build logs for missing dependencies.
- worker image includes Semgrep and Tree-sitter dependencies.
- API and worker can reach Redis and NeonDB.
- migration command has run.

Action:

- Reproduce locally with `docker compose up --build`.
- Fix Dockerfile or env mismatch before retrying deployment.
- Roll back to previous Coolify deployment if available.
- Keep dry-run enabled until the deployed stack passes smoke tests.
