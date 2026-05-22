#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to your NeonDB connection string before running Docker smoke checks}"
export DATABASE_SSL="${DATABASE_SSL:-true}"

docker compose build api worker
docker compose up -d redis api worker

docker compose exec -T api node -e "fetch('http://localhost:3001/health').then(async (response) => { if (!response.ok) process.exit(1); console.log(await response.text()); }).catch((error) => { console.error(error); process.exit(1); })"
docker compose exec -T api node -e "fetch('http://localhost:3001/health/ready').then(async (response) => { const body = await response.json(); if (body.status !== 'ok') { console.error(body); process.exit(1); } console.log(JSON.stringify(body)); }).catch((error) => { console.error(error); process.exit(1); })"
docker compose exec -T worker python -m firmcode_worker.runtime --check

docker compose logs worker | grep "worker.queue.connected"
