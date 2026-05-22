#!/usr/bin/env bash
set -euo pipefail

if ! command -v semgrep >/dev/null 2>&1; then
  echo "Semgrep CLI is not installed. Install semgrep, then rerun: npm run semgrep:infra:test" >&2
  exit 127
fi

semgrep scan --test --config infra/semgrep/config.yml infra/semgrep/tests
