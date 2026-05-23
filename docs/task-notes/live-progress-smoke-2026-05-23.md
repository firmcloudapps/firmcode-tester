# Live progress smoke test

This temporary note exercises the online GitHub webhook and worker progress publisher after removing the queued scanning placeholder.

Second delivery: verifies the deployed worker handles a synchronize event after the production image refresh.

Third delivery: verifies repeated summary comment updates stay idempotent across online webhook events.

Fourth delivery: confirms the production idempotency hotfix is active after the Coolify deployment window.
