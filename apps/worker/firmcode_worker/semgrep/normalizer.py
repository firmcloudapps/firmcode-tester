from __future__ import annotations

import hashlib
from collections.abc import Mapping
from typing import Any

from firmcode_worker.schemas.contracts import SEMGREP_ARTIFACT_SCHEMA_VERSION


SEMGREP_FINDING_EXIT_CODES = {0, 1}

_SEVERITY_MAP = {
    "CRITICAL": "critical",
    "HIGH": "high",
    "ERROR": "high",
    "MEDIUM": "medium",
    "WARNING": "medium",
    "LOW": "low",
    "INFO": "info",
    "EXPERIMENT": "info",
    "INVENTORY": "info",
}

_ERROR_SEVERITY_MAP = {
    "error": "error",
    "warn": "warning",
    "warning": "warning",
    "info": "info",
}


def normalize_semgrep_output(
    *,
    review_run_id: str,
    semgrep_json: Mapping[str, Any],
    exit_code: int,
    duration_ms: int,
    stderr: str = "",
) -> dict[str, Any]:
    findings = [_normalize_finding(result) for result in _read_list(semgrep_json.get("results"))]
    errors = [_normalize_error(error) for error in _read_list(semgrep_json.get("errors"))]
    paths = _normalize_paths(semgrep_json.get("paths"))

    if exit_code not in SEMGREP_FINDING_EXIT_CODES and not errors:
        errors.append(
            {
                "code": "process_exit",
                "message": _bounded_message(stderr) or f"Semgrep exited with status {exit_code}.",
                "path": None,
                "severity": "error",
            }
        )

    return {
        "schemaVersion": SEMGREP_ARTIFACT_SCHEMA_VERSION,
        "reviewRunId": review_run_id,
        "toolVersion": _read_optional_str(semgrep_json.get("version")),
        "exitCode": exit_code,
        "durationMs": max(duration_ms, 0),
        "findings": findings,
        "errors": errors,
        "paths": paths,
    }


def normalize_semgrep_process_failure(
    *,
    review_run_id: str,
    exit_code: int,
    duration_ms: int,
    code: str,
    message: str,
    stderr: str = "",
) -> dict[str, Any]:
    detail = _bounded_message(stderr)
    normalized_message = f"{message}: {detail}" if detail else message
    return {
        "schemaVersion": SEMGREP_ARTIFACT_SCHEMA_VERSION,
        "reviewRunId": review_run_id,
        "toolVersion": None,
        "exitCode": exit_code,
        "durationMs": max(duration_ms, 0),
        "findings": [],
        "errors": [
            {
                "code": code,
                "message": normalized_message,
                "path": None,
                "severity": "error",
            }
        ],
        "paths": {"scanned": [], "skipped": []},
    }


def _normalize_finding(value: Any) -> dict[str, Any]:
    item = value if isinstance(value, Mapping) else {}
    extra = item.get("extra") if isinstance(item.get("extra"), Mapping) else {}
    rule_id = _read_str(item.get("check_id"), "unknown_rule")
    path = _read_str(item.get("path"), "unknown")
    start = _normalize_position(item.get("start"))
    end = _normalize_position(item.get("end"))
    lines = _read_str(extra.get("lines"), "")
    fingerprint = _read_optional_str(extra.get("fingerprint"))

    return {
        "id": _finding_id(
            rule_id=rule_id,
            path=path,
            start_line=start["line"],
            end_line=end["line"],
            lines=lines,
            fingerprint=fingerprint,
        ),
        "ruleId": rule_id,
        "path": path,
        "start": start,
        "end": end,
        "severity": _normalize_severity(_read_str(extra.get("severity"), "INFO")),
        "sourceSeverity": _read_str(extra.get("severity"), "INFO"),
        "message": _read_str(extra.get("message"), "Semgrep finding"),
        "fingerprint": fingerprint,
        "lines": lines,
        "metadata": extra.get("metadata") if isinstance(extra.get("metadata"), Mapping) else {},
        "fix": _read_optional_str(extra.get("fix")),
    }


def _normalize_error(value: Any) -> dict[str, Any]:
    item = value if isinstance(value, Mapping) else {}
    error_type = _read_str(item.get("type"), "")
    code = error_type or _read_str(item.get("code"), "semgrep_error")
    message = (
        _read_optional_str(item.get("message"))
        or _read_optional_str(item.get("long_msg"))
        or _read_optional_str(item.get("short_msg"))
        or "Semgrep reported an error."
    )

    return {
        "code": code,
        "message": message,
        "path": _read_optional_str(item.get("path")),
        "severity": _ERROR_SEVERITY_MAP.get(_read_str(item.get("level"), "error").lower(), "error"),
    }


def _normalize_paths(value: Any) -> dict[str, Any]:
    item = value if isinstance(value, Mapping) else {}
    return {
        "scanned": [_read_str(path, "unknown") for path in _read_list(item.get("scanned"))],
        "skipped": [_normalize_skipped_path(path) for path in _read_list(item.get("skipped"))],
    }


def _normalize_skipped_path(value: Any) -> dict[str, Any]:
    item = value if isinstance(value, Mapping) else {}
    return {
        "path": _read_str(item.get("path"), "unknown"),
        "reason": _read_str(item.get("reason"), "unknown"),
        "detail": _read_optional_str(item.get("details")),
    }


def _normalize_position(value: Any) -> dict[str, int | None]:
    item = value if isinstance(value, Mapping) else {}
    return {
        "line": _positive_int(item.get("line"), default=1),
        "column": _non_negative_int(item.get("col"), default=0),
        "offset": _nullable_non_negative_int(item.get("offset")),
    }


def _finding_id(*, rule_id: str, path: str, start_line: int, end_line: int, lines: str, fingerprint: str | None) -> str:
    identity = f"{rule_id}\0{path}\0{start_line}\0{end_line}\0{fingerprint or lines}"
    digest = hashlib.sha256(identity.encode()).hexdigest()[:12]
    return f"semgrep:{rule_id}:{path}:{start_line}:{digest}"


def _normalize_severity(value: str) -> str:
    return _SEVERITY_MAP.get(value.upper(), "info")


def _read_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _read_str(value: Any, default: str) -> str:
    return value if isinstance(value, str) and value.strip() else default


def _read_optional_str(value: Any) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


def _positive_int(value: Any, *, default: int) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) and value > 0 else default


def _non_negative_int(value: Any, *, default: int) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else default


def _nullable_non_negative_int(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None


def _bounded_message(value: str, limit: int = 800) -> str:
    message = value.strip()
    return message[:limit]
