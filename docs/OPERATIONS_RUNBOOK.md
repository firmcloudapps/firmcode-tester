# Operations Runbook

This runbook covers common operational issues for Firmcode.

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
- Clerk publishable key and redirect URLs.
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
