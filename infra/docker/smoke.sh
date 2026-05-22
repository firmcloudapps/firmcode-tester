#!/usr/bin/env bash
set -euo pipefail

if [[ -f .env ]]; then
  while IFS='=' read -r key value; do
    case "$key" in
      DATABASE_URL | DATABASE_SSL)
        if [[ -z "${!key:-}" && -n "${value:-}" ]]; then
          export "$key=$value"
        fi
        ;;
    esac
  done <.env
fi

: "${DATABASE_URL:?Set DATABASE_URL to your NeonDB connection string before running Docker smoke checks}"
export DATABASE_SSL="${DATABASE_SSL:-true}"

run_with_retries() {
  local description="$1"
  shift

  for attempt in {1..30}; do
    if "$@"; then
      return 0
    fi

    if [[ "$attempt" -eq 30 ]]; then
      echo "$description failed after $attempt attempts" >&2
      return 1
    fi

    sleep 2
  done
}

docker compose build api worker
docker compose up -d redis api worker

run_with_retries "API health check" docker compose exec -T api node -e "fetch('http://localhost:3001/health').then(async (response) => { if (!response.ok) process.exit(1); console.log(await response.text()); }).catch((error) => { console.error(error); process.exit(1); })"
run_with_retries "API readiness check" docker compose exec -T api node -e "fetch('http://localhost:3001/health/ready').then(async (response) => { const body = await response.json(); if (body.status !== 'ok') { console.error(body); process.exit(1); } console.log(JSON.stringify(body)); }).catch((error) => { console.error(error); process.exit(1); })"
run_with_retries "Worker runtime check" docker compose exec -T worker python -m firmcode_worker.runtime --check

docker compose logs worker | grep "worker.queue.connected"
