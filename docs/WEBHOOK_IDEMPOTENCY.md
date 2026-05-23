# Webhook Idempotency And Event Ordering

GitHub webhooks can arrive more than once and out of order. Firmcode must treat webhook handling as idempotent.

## Delivery Storage

Store every accepted GitHub delivery:

- `delivery_id`
- `event_name`
- `action`
- `installation_id`
- `repository_id`
- `pull_request_number`
- `head_sha`
- `received_at`
- `processed_at`
- `status`
- `error`

Unique key: `delivery_id`.

## Duplicate Handling

- If a delivery ID already exists, return `202 Accepted`.
- Do not enqueue a duplicate review job.
- Keep the original processing result.

## PR Synchronize Behavior

When a new `pull_request.synchronize` event arrives:

- Create a new review run for the new `head_sha`.
- Cancel or mark superseded queued/running review runs for older SHAs when safe.
- Never publish comments from a superseded run unless it completed before supersession and still targets the same head SHA.

## Push Fallback Behavior

When a `push` event arrives for a branch, Firmcode resolves open pull requests associated with the pushed `after` SHA through GitHub's commit-to-pull-requests API. If an open PR is found, the API creates the same review run, queue job, supersession, and activity comment flow as a `pull_request.synchronize` event. Deleted refs, tag pushes, and branch pushes without an associated open PR are accepted and marked ignored.

The current review-run schema has one review run per GitHub delivery ID, so a push delivery processes the first open associated PR whose head SHA matches the pushed SHA.

## Event Ordering

Use `head_sha` as the review identity. Before publishing:

- Re-fetch current PR head SHA.
- If current head SHA differs from the review run head SHA, mark run as superseded and skip publishing.

## Supported Events

Initial supported events:

- `push`
- `pull_request.opened`
- `pull_request.synchronize`
- `pull_request.reopened`
- `pull_request.ready_for_review`
- `check_run.completed`
- `check_suite.completed`
- `workflow_run.completed`
- `installation.created`
- `installation.deleted`
- `installation_repositories.added`
- `installation_repositories.removed`

Unsupported events should return `202 Accepted` and record minimal metadata when useful.

## Replay Testing

Tests should cover:

- duplicate delivery ID
- same PR with new head SHA
- old run trying to publish after newer synchronize event
- unsupported event
- invalid signature
- missing installation
