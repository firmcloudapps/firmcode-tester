# Task 0.2 Implementation Notes

## Planning Docs Applied

- `AGENTS.md`
- `docs/TASKS.md`
- `docs/ADR.md`
- `docs/DEPLOYMENT.md`
- `docs/LOCAL_DEVELOPMENT.md`
- `docs/ENVIRONMENT.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/REFERENCE_ANALYSIS.md`

## Reference Policy

No code was imported from or written into `pr-agent/`, `semgrep/`, or `tree-sitter/`. Task 0.2 is runtime/container infrastructure rather than an analogous review, scan, or parser implementation. `docs/REFERENCE_ANALYSIS.md` informed the worker image requirement to keep Semgrep behind a CLI/process boundary and Tree-sitter behind runtime availability checks.

## Docker Shape

- Root `docker-compose.yml` starts `api`, `worker`, and `redis`.
- API and worker use external NeonDB through host-provided `DATABASE_URL` and internal Redis through `redis:6379`.
- Web runs outside Docker with `npm run dev --workspace @firmcode/web` locally and deploys to Vercel in production.
- API exposes `/health` for liveness and `/health/ready` for NeonDB/Redis reachability.
- Worker starts through `python -m firmcode_worker.runtime`, validates `DATABASE_URL`/`REDIS_URL`, checks NeonDB/Redis sockets, verifies that the Semgrep executable exists, verifies `tree_sitter` importability, logs `worker.queue.connected`, and stays alive for future queue processing.
- Host port bindings are configurable with `API_PORT` and `REDIS_PORT`; container networking still uses stable service names and container ports.

## Smoke Commands

```bash
export DATABASE_URL="postgresql://firmcode_owner:<password>@ep-example.us-east-2.aws.neon.tech/firmcode?sslmode=require"
export DATABASE_SSL=true
bash infra/docker/smoke.sh
```

Equivalent manual checks:

```bash
docker compose build api worker
docker compose up -d redis api worker
docker compose exec -T api node -e "fetch('http://localhost:3001/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
docker compose exec -T api node -e "fetch('http://localhost:3001/health/ready').then(async (r)=>{ const body = await r.json(); process.exit(body.status === 'ok' ? 0 : 1); }).catch(()=>process.exit(1))"
docker compose exec -T worker python -m firmcode_worker.runtime --check
docker compose logs worker | grep "worker.queue.connected"
```
