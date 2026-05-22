from __future__ import annotations

import argparse
import importlib.util
import json
import os
import signal
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from typing import Mapping
from urllib.parse import urlparse


@dataclass(frozen=True)
class WorkerRuntimeConfig:
    database_url: str
    redis_url: str
    log_level: str


@dataclass(frozen=True)
class DependencyCheck:
    name: str
    status: str
    host: str | None = None
    port: int | None = None
    error: str | None = None


def load_worker_config(env: Mapping[str, str] = os.environ) -> WorkerRuntimeConfig:
    database_url = _read_required(env, "DATABASE_URL")
    redis_url = _read_required(env, "REDIS_URL")

    _validate_url(database_url, ("postgres", "postgresql"), "DATABASE_URL")
    _validate_url(redis_url, ("redis", "rediss"), "REDIS_URL")

    return WorkerRuntimeConfig(
        database_url=database_url,
        redis_url=redis_url,
        log_level=env.get("LOG_LEVEL", "info"),
    )


def run_startup_checks(config: WorkerRuntimeConfig) -> list[DependencyCheck]:
    return [
        _check_tcp_url("database", config.database_url, 5432),
        _check_tcp_url("redis", config.redis_url, 6379),
        _check_semgrep(),
        _check_tree_sitter(),
    ]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Firmcode worker runtime")
    parser.add_argument("--check", action="store_true", help="run startup checks and exit")
    args = parser.parse_args(argv)

    try:
        config = load_worker_config()
        checks = run_startup_checks(config)
    except ValueError as error:
        _log("worker.startup.failed", status="unavailable", error=str(error))
        return 1

    status = "ok" if all(check.status == "ok" for check in checks) else "unavailable"
    _log(
        "worker.startup.completed",
        status=status,
        dependencies=[_check_to_dict(check) for check in checks],
    )

    if args.check:
        return 0 if status == "ok" else 1

    if status != "ok":
        return 1

    _log("worker.queue.connected", status="ok")
    return _run_forever()


def _run_forever() -> int:
    should_stop = False

    def stop(_signum: int, _frame: object) -> None:
        nonlocal should_stop
        should_stop = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    while not should_stop:
        time.sleep(5)

    _log("worker.shutdown", status="ok")
    return 0


def _read_required(env: Mapping[str, str], name: str) -> str:
    value = env.get(name, "").strip()
    if not value:
        raise ValueError(f"{name} is required")
    return value


def _validate_url(value: str, schemes: tuple[str, ...], name: str) -> None:
    parsed = urlparse(value)
    if parsed.scheme not in schemes or not parsed.hostname:
        raise ValueError(f"{name} must be a {', '.join(schemes)} connection string")


def _check_tcp_url(name: str, raw_url: str, default_port: int) -> DependencyCheck:
    parsed = urlparse(raw_url)
    host = parsed.hostname
    port = parsed.port or default_port

    if host is None:
        return DependencyCheck(name=name, status="unavailable", error="missing_host")

    try:
        with socket.create_connection((host, port), timeout=1.5):
            return DependencyCheck(name=name, status="ok", host=host, port=port)
    except OSError as error:
        return DependencyCheck(name=name, status="unavailable", host=host, port=port, error=error.__class__.__name__)


def _check_semgrep() -> DependencyCheck:
    try:
        subprocess.run(
            ["semgrep", "--version"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
        )
        return DependencyCheck(name="semgrep", status="ok")
    except (OSError, subprocess.SubprocessError) as error:
        return DependencyCheck(name="semgrep", status="unavailable", error=error.__class__.__name__)


def _check_tree_sitter() -> DependencyCheck:
    if importlib.util.find_spec("tree_sitter") is None:
        return DependencyCheck(name="tree_sitter", status="unavailable", error="module_missing")

    return DependencyCheck(name="tree_sitter", status="ok")


def _check_to_dict(check: DependencyCheck) -> dict[str, str | int | None]:
    return {
        key: value
        for key, value in {
            "name": check.name,
            "status": check.status,
            "host": check.host,
            "port": check.port,
            "error": check.error,
        }.items()
        if value is not None
    }


def _log(event: str, **fields: object) -> None:
    print(json.dumps({"event": event, **fields}, sort_keys=True), flush=True)


if __name__ == "__main__":
    sys.exit(main())
