# Firmcode Docker Runtime

Firmcode uses Docker-first local development for the NestJS API and Python worker so they run close to their Coolify container shape. The Next.js dashboard runs independently with `next dev` locally and deploys to Vercel in production.

## Files

- `../../docker-compose.yml` defines the local `api`, `worker`, and `redis` stack.
- `../../docker-compose.prod.yml` defines the production/Coolify `api`, `worker`, and internal `redis` stack that pulls prebuilt API and worker images from Docker Hub.
- `api.Dockerfile` builds the local NestJS API image and runs `npm run start --workspace @firmcode/api`.
- `worker.Dockerfile` builds the local Python worker image with Semgrep CLI and Tree-sitter runtime dependency.
- `api.prod.Dockerfile` builds the production NestJS API image without copying `apps/web`; GitHub Actions publishes it.
- `worker.prod.Dockerfile` builds the production Python worker image; GitHub Actions publishes it.
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

For a production/Coolify Compose render:

```bash
docker compose -f docker-compose.prod.yml config --quiet
```

Production Compose intentionally excludes PostgreSQL and the Next.js web app. NeonDB remains external, and the dashboard deploys separately to Vercel.
