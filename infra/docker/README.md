# Firmcode Docker Runtime

Firmcode uses Docker-first local development for the NestJS API and Python worker so they run close to their Coolify container shape. The Next.js dashboard runs independently with `next dev` locally and deploys to Vercel in production.

## Files

- `../../docker-compose.yml` defines `api`, `worker`, and `redis`.
- `api.Dockerfile` builds the NestJS API image and runs `npm run start --workspace @firmcode/api`.
- `worker.Dockerfile` builds the Python worker image with Semgrep CLI and Tree-sitter runtime dependency.
- `smoke.sh` builds the service images and checks container-network reachability.

## Smoke Path

Run the full Task 0.2 smoke check from the repo root:

```bash
export DATABASE_URL="postgresql://firmcode_owner:<password>@ep-example.us-east-2.aws.neon.tech/firmcode?sslmode=require"
export DATABASE_SSL=true
bash infra/docker/smoke.sh
```

The script verifies:

- API and worker images build.
- Redis becomes healthy.
- API `/health` and `/health/ready` are reachable from inside the API container.
- Worker startup checks can reach NeonDB and Redis and can load Semgrep and Tree-sitter.
- Worker logs `worker.queue.connected`.

For a manual local stack:

```bash
DATABASE_URL="postgresql://..." docker compose up --build
```

If a host port is already in use, override it without changing container networking:

```bash
API_PORT=3301 docker compose up --build api
```
