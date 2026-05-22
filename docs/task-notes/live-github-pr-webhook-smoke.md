# Live GitHub PR Webhook Smoke

This note exists to create a small, safe PR for testing Firmcode against a real GitHub repository.

Expected live path:

- Opening the PR sends a `pull_request.opened` webhook to the configured Firmcode API.
- Pushing another commit to the same branch sends a `pull_request.synchronize` webhook.
- The API should accept the delivery, persist the delivery/review run, and enqueue review processing.
- This branch includes a follow-up push after PR creation to exercise the synchronize path.

Remove this file after the live webhook path is verified.
