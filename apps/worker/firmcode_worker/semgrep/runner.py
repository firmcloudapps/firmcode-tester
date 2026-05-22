from __future__ import annotations

import json
import os
import subprocess
import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from firmcode_worker.semgrep.normalizer import (
    normalize_semgrep_output,
    normalize_semgrep_process_failure,
)


DEFAULT_SEMGREP_TIMEOUT_MS = 30_000
DEFAULT_SEMGREP_CONFIGS = ("auto",)
SEMGREP_RAW_ARTIFACT_SCHEMA_VERSION = "semgrep-raw-output/v1"


class SemgrepProcessError(RuntimeError):
    pass


@dataclass(frozen=True)
class SemgrepScanConfig:
    configs: tuple[str, ...] = DEFAULT_SEMGREP_CONFIGS
    timeout_ms: int = DEFAULT_SEMGREP_TIMEOUT_MS
    executable: str = "semgrep"

    @classmethod
    def from_env(cls, env: Mapping[str, str] = os.environ) -> "SemgrepScanConfig":
        configs = tuple(
            config.strip()
            for config in env.get("SEMGREP_CONFIGS", ",".join(DEFAULT_SEMGREP_CONFIGS)).split(",")
            if config.strip()
        )
        timeout_ms = _read_positive_int(env.get("SEMGREP_TIMEOUT_MS"), DEFAULT_SEMGREP_TIMEOUT_MS)
        executable = env.get("SEMGREP_EXECUTABLE", "semgrep").strip() or "semgrep"
        return cls(configs=configs or DEFAULT_SEMGREP_CONFIGS, timeout_ms=timeout_ms, executable=executable)


@dataclass(frozen=True)
class RawSemgrepOutput:
    command: tuple[str, ...]
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int
    timed_out: bool


@dataclass(frozen=True)
class SemgrepRawArtifact:
    schema_version: str
    review_run_id: str
    path: Path


@dataclass(frozen=True)
class SemgrepScanResult:
    artifact: dict[str, Any]
    raw_output: RawSemgrepOutput
    raw_artifact: SemgrepRawArtifact | None


def run_semgrep_scan(
    *,
    review_run_id: str,
    targets: Sequence[str | Path],
    config: SemgrepScanConfig | None = None,
    cwd: str | Path | None = None,
    artifact_dir: str | Path | None = None,
) -> SemgrepScanResult:
    scan_config = config or SemgrepScanConfig.from_env()
    command = _build_command(scan_config=scan_config, targets=targets)
    raw_output = _run_command(command=command, timeout_ms=scan_config.timeout_ms, cwd=cwd)
    raw_artifact = _write_raw_artifact(review_run_id=review_run_id, raw_output=raw_output, artifact_dir=artifact_dir)
    normalized = _normalize_process_output(review_run_id=review_run_id, raw_output=raw_output)

    return SemgrepScanResult(artifact=normalized, raw_output=raw_output, raw_artifact=raw_artifact)


def _build_command(*, scan_config: SemgrepScanConfig, targets: Sequence[str | Path]) -> tuple[str, ...]:
    if not targets:
        raise SemgrepProcessError("Semgrep scan requires at least one target.")
    if scan_config.timeout_ms <= 0:
        raise SemgrepProcessError("Semgrep timeout must be positive.")

    command = [scan_config.executable, "scan", "--json", "--metrics=off"]
    for config in scan_config.configs:
        command.extend(["--config", config])
    command.extend(str(target) for target in targets)
    return tuple(command)


def _run_command(*, command: tuple[str, ...], timeout_ms: int, cwd: str | Path | None) -> RawSemgrepOutput:
    started = time.monotonic_ns()
    try:
        completed = subprocess.run(
            command,
            cwd=Path(cwd) if cwd is not None else None,
            capture_output=True,
            text=True,
            timeout=timeout_ms / 1000,
            check=False,
        )
        duration_ms = _elapsed_ms(started)
        return RawSemgrepOutput(
            command=command,
            exit_code=completed.returncode,
            stdout=completed.stdout,
            stderr=completed.stderr,
            duration_ms=duration_ms,
            timed_out=False,
        )
    except subprocess.TimeoutExpired as error:
        return RawSemgrepOutput(
            command=command,
            exit_code=-1,
            stdout=_decode_process_output(error.stdout),
            stderr=_decode_process_output(error.stderr),
            duration_ms=_elapsed_ms(started),
            timed_out=True,
        )
    except OSError as error:
        return RawSemgrepOutput(
            command=command,
            exit_code=127,
            stdout="",
            stderr=str(error),
            duration_ms=_elapsed_ms(started),
            timed_out=False,
        )


def _normalize_process_output(*, review_run_id: str, raw_output: RawSemgrepOutput) -> dict[str, Any]:
    if raw_output.timed_out:
        return normalize_semgrep_process_failure(
            review_run_id=review_run_id,
            exit_code=raw_output.exit_code,
            duration_ms=raw_output.duration_ms,
            code="timeout",
            message=f"Semgrep timed out after {raw_output.duration_ms} ms.",
            stderr=raw_output.stderr,
        )

    try:
        parsed = json.loads(raw_output.stdout) if raw_output.stdout.strip() else {}
    except json.JSONDecodeError as error:
        return normalize_semgrep_process_failure(
            review_run_id=review_run_id,
            exit_code=raw_output.exit_code,
            duration_ms=raw_output.duration_ms,
            code="invalid_json",
            message=f"Semgrep did not produce valid JSON: {error.msg}.",
            stderr=raw_output.stderr,
        )

    if not isinstance(parsed, Mapping):
        return normalize_semgrep_process_failure(
            review_run_id=review_run_id,
            exit_code=raw_output.exit_code,
            duration_ms=raw_output.duration_ms,
            code="invalid_json",
            message="Semgrep JSON output was not an object.",
            stderr=raw_output.stderr,
        )

    return normalize_semgrep_output(
        review_run_id=review_run_id,
        semgrep_json=parsed,
        exit_code=raw_output.exit_code,
        duration_ms=raw_output.duration_ms,
        stderr=raw_output.stderr,
    )


def _write_raw_artifact(
    *,
    review_run_id: str,
    raw_output: RawSemgrepOutput,
    artifact_dir: str | Path | None,
) -> SemgrepRawArtifact | None:
    if artifact_dir is None:
        return None

    output_dir = Path(artifact_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{review_run_id}.semgrep.raw.json"
    output_path.write_text(
        json.dumps(
            {
                "schemaVersion": SEMGREP_RAW_ARTIFACT_SCHEMA_VERSION,
                "reviewRunId": review_run_id,
                "command": list(raw_output.command),
                "exitCode": raw_output.exit_code,
                "durationMs": raw_output.duration_ms,
                "timedOut": raw_output.timed_out,
                "stdout": raw_output.stdout,
                "stderr": raw_output.stderr,
            },
            indent=2,
            sort_keys=True,
        )
        + "\n"
    )
    return SemgrepRawArtifact(
        schema_version=SEMGREP_RAW_ARTIFACT_SCHEMA_VERSION,
        review_run_id=review_run_id,
        path=output_path,
    )


def _read_positive_int(value: str | None, default: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def _elapsed_ms(started_monotonic_ns: int) -> int:
    return max(round((time.monotonic_ns() - started_monotonic_ns) / 1_000_000), 0)


def _decode_process_output(value: str | bytes | None) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode(errors="replace")
    return value
