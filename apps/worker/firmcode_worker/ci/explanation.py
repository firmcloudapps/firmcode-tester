from __future__ import annotations

import hashlib
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from firmcode_worker.schemas.contracts import (
    CI_FAILURE_EXPLANATION_SCHEMA_VERSION,
    CiFailureExplanationArtifact,
    CiLogArtifact,
)


_ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
_TIMESTAMP_PREFIX_RE = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z\s+")
_STEP_GROUP_RE = re.compile(r"^(?:##\[group\])?Run\s+(.+)$")
_GENERIC_GROUP_RE = re.compile(r"^##\[group\](.+)$")
_PROCESS_EXIT_RE = re.compile(r"Process completed with exit code \d+\.?", re.IGNORECASE)
_TSC_ERROR_RE = re.compile(r"\bTS\d{4}\b")

_FAILURE_PATTERNS = (
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"##\[error\]",
        r"\bAssertionError\b",
        r"\b(?:FAIL|FAILED)\b",
        r"\bTests? failed\b",
        r"\bError:",
        r"\bTraceback\b",
        r"\bTypeError\b",
        r"\bReferenceError\b",
        r"\bModuleNotFoundError\b",
        r"\bImportError\b",
        r"\bCannot find module\b",
        r"\bnpm ERR!",
        r"\bCommand failed\b",
        r"\bProcess completed with exit code\b",
        r"\bTimeoutError\b",
        r"\btimeout\b",
        r"\btimed? out\b",
        r"\bNo such file or directory\b",
        r"\bNo space left on device\b",
        r"\bKilled\b",
        r"\bmake: \*\*\*",
    )
)
_FAILURE_PATTERNS = tuple(_FAILURE_PATTERNS)

_CATEGORY_PATTERNS: tuple[tuple[str, tuple[re.Pattern[str], ...]], ...] = (
    (
        "dependency_failure",
        (
            re.compile(r"\bCannot find module\b", re.IGNORECASE),
            re.compile(r"\bModuleNotFoundError\b", re.IGNORECASE),
            re.compile(r"\bImportError\b", re.IGNORECASE),
            re.compile(r"\bNo module named\b", re.IGNORECASE),
            re.compile(r"\bNo matching distribution\b", re.IGNORECASE),
            re.compile(r"\bERESOLVE\b", re.IGNORECASE),
            re.compile(r"\blockfile\b", re.IGNORECASE),
        ),
    ),
    (
        "typecheck_failure",
        (
            re.compile(r"\btsc\b", re.IGNORECASE),
            _TSC_ERROR_RE,
            re.compile(r"\bmypy\b", re.IGNORECASE),
            re.compile(r"\bpyright\b", re.IGNORECASE),
            re.compile(r"\btype error\b", re.IGNORECASE),
        ),
    ),
    (
        "lint_failure",
        (
            re.compile(r"\beslint\b", re.IGNORECASE),
            re.compile(r"\bruff\b", re.IGNORECASE),
            re.compile(r"\bflake8\b", re.IGNORECASE),
            re.compile(r"\bprettier\b", re.IGNORECASE),
            re.compile(r"\bblack\b", re.IGNORECASE),
            re.compile(r"\blint\b", re.IGNORECASE),
        ),
    ),
    (
        "timeout",
        (
            re.compile(r"\btimed? out\b", re.IGNORECASE),
            re.compile(r"\btimeout\b", re.IGNORECASE),
            re.compile(r"\bTimeoutError\b", re.IGNORECASE),
            re.compile(r"\bdeadline exceeded\b", re.IGNORECASE),
        ),
    ),
    (
        "infrastructure",
        (
            re.compile(r"\bECONNRESET\b", re.IGNORECASE),
            re.compile(r"\bEAI_AGAIN\b", re.IGNORECASE),
            re.compile(r"\bconnection refused\b", re.IGNORECASE),
            re.compile(r"\bcould not resolve host\b", re.IGNORECASE),
            re.compile(r"\brate limit\b", re.IGNORECASE),
            re.compile(r"\b(?:502|503|504)\b"),
            re.compile(r"\bNo space left on device\b", re.IGNORECASE),
            re.compile(r"\bout of memory\b", re.IGNORECASE),
        ),
    ),
    (
        "build_failure",
        (
            re.compile(r"\bbuild failed\b", re.IGNORECASE),
            re.compile(r"\bcompilation failed\b", re.IGNORECASE),
            re.compile(r"\bwebpack\b", re.IGNORECASE),
            re.compile(r"\bvite build\b", re.IGNORECASE),
            re.compile(r"\bnext build\b", re.IGNORECASE),
            re.compile(r"\bdocker build\b", re.IGNORECASE),
            re.compile(r"\bmake: \*\*\*", re.IGNORECASE),
        ),
    ),
    (
        "test_failure",
        (
            re.compile(r"\bAssertionError\b", re.IGNORECASE),
            re.compile(r"\bexpected\b.+\breceived\b", re.IGNORECASE),
            re.compile(r"\b(?:FAIL|FAILED)\b", re.IGNORECASE),
            re.compile(r"\bTests? failed\b", re.IGNORECASE),
            re.compile(r"\bpytest\b", re.IGNORECASE),
            re.compile(r"\bjest\b", re.IGNORECASE),
            re.compile(r"\bvitest\b", re.IGNORECASE),
            re.compile(r"\bgo test\b", re.IGNORECASE),
            re.compile(r"\bcargo test\b", re.IGNORECASE),
            re.compile(r"\bpanicked at\b", re.IGNORECASE),
        ),
    ),
    (
        "cancellation",
        (
            re.compile(r"\bcancelled\b", re.IGNORECASE),
            re.compile(r"\bcanceled\b", re.IGNORECASE),
        ),
    ),
)

_FLAKY_PATTERNS: tuple[tuple[str, float, tuple[re.Pattern[str], ...]], ...] = (
    (
        "explicit_flaky",
        0.9,
        (
            re.compile(r"\bflak(?:y|iness)\b", re.IGNORECASE),
            re.compile(r"\bintermittent\b", re.IGNORECASE),
            re.compile(r"\bnon[- ]?deterministic\b", re.IGNORECASE),
        ),
    ),
    (
        "timeout",
        0.74,
        (
            re.compile(r"\btimed? out\b", re.IGNORECASE),
            re.compile(r"\btimeout\b", re.IGNORECASE),
            re.compile(r"\bTimeoutError\b", re.IGNORECASE),
            re.compile(r"\bdeadline exceeded\b", re.IGNORECASE),
            re.compile(r"\bwaited \d+", re.IGNORECASE),
        ),
    ),
    (
        "network_or_service",
        0.72,
        (
            re.compile(r"\bECONNRESET\b", re.IGNORECASE),
            re.compile(r"\bETIMEDOUT\b", re.IGNORECASE),
            re.compile(r"\bEAI_AGAIN\b", re.IGNORECASE),
            re.compile(r"\btemporary failure\b", re.IGNORECASE),
            re.compile(r"\b(?:502|503|504)\b"),
            re.compile(r"\brate limit\b", re.IGNORECASE),
        ),
    ),
    (
        "concurrency_or_order",
        0.68,
        (
            re.compile(r"\brace condition\b", re.IGNORECASE),
            re.compile(r"\bdeadlock\b", re.IGNORECASE),
            re.compile(r"\border[- ]dependent\b", re.IGNORECASE),
            re.compile(r"\brandom seed\b", re.IGNORECASE),
            re.compile(r"\baddress already in use\b", re.IGNORECASE),
            re.compile(r"\bEADDRINUSE\b", re.IGNORECASE),
        ),
    ),
    (
        "runner_resource",
        0.64,
        (
            re.compile(r"\bNo space left on device\b", re.IGNORECASE),
            re.compile(r"\bout of memory\b", re.IGNORECASE),
            re.compile(r"\bOOM\b", re.IGNORECASE),
            re.compile(r"\bKilled\b", re.IGNORECASE),
            re.compile(r"\bresource temporarily unavailable\b", re.IGNORECASE),
        ),
    ),
)


@dataclass(frozen=True)
class FlakySignal:
    signal: str
    detail: str
    confidence: float


@dataclass(frozen=True)
class _StepSegment:
    name: str | None
    lines: tuple[str, ...]


def generate_ci_failure_explanation(ci_log_artifact: CiLogArtifact | Mapping[str, Any]) -> dict[str, Any]:
    artifact = _coerce_ci_log_artifact(ci_log_artifact)
    check_runs = {check.id: check for check in artifact.check_runs}
    groups: list[dict[str, Any]] = []

    for log in artifact.logs:
        check_run = check_runs.get(log.check_run_id)
        job_name = check_run.name if check_run is not None else log.name
        conclusion = check_run.conclusion if check_run is not None else "failure"

        for segment in _failure_segments(log.content):
            excerpt = _failure_excerpt(segment.lines)
            category = _classify_category(conclusion=conclusion, text=excerpt, step_name=segment.name)
            flaky_signals = classify_flaky_signals(excerpt)
            root_cause = _root_cause_summary(
                job_name=job_name,
                step_name=segment.name,
                category=category,
                excerpt=excerpt,
                flaky_signals=flaky_signals,
            )
            group_id = _group_id(log.check_run_id, segment.name or job_name, excerpt)
            groups.append(
                {
                    "id": group_id,
                    "jobName": job_name,
                    "checkRunId": log.check_run_id,
                    "conclusion": conclusion,
                    "stepName": segment.name,
                    "category": category,
                    "rootCauseSummary": root_cause,
                    "suggestedFixes": _suggested_fixes(category=category, step_name=segment.name, flaky=bool(flaky_signals)),
                    "flaky": bool(flaky_signals),
                    "flakySignals": [_flaky_signal_payload(signal) for signal in flaky_signals],
                    "evidence": [
                        {
                            "checkRunId": log.check_run_id,
                            "workflowJobId": log.workflow_job_id,
                            "stepName": segment.name,
                            "excerpt": excerpt,
                        }
                    ],
                }
            )

    if not groups and artifact.logs:
        groups.extend(_fallback_groups_for_logs(artifact, check_runs))

    return {
        "schemaVersion": CI_FAILURE_EXPLANATION_SCHEMA_VERSION,
        "reviewRunId": artifact.review_run_id,
        "repositoryFullName": artifact.repository_full_name,
        "pullRequestNumber": artifact.pull_request_number,
        "headSha": artifact.head_sha,
        "summary": _summary(groups=groups, unavailable_logs=artifact.unavailable_logs),
        "groups": groups,
        "unavailableLogNotes": [
            {
                "checkRunId": note.check_run_id,
                "name": note.name,
                "reason": note.reason,
                "detail": note.detail,
            }
            for note in artifact.unavailable_logs
        ],
    }


def render_ci_failure_explanation_markdown(
    explanation: CiFailureExplanationArtifact | Mapping[str, Any],
    *,
    include_evidence: bool = True,
) -> str:
    artifact = _coerce_ci_failure_explanation(explanation)
    lines = [artifact.summary]

    for group in artifact.groups:
        step = f" / `{group.step_name}`" if group.step_name else ""
        lines.extend(
            [
                "",
                f"- `{group.job_name}`{step}: {group.root_cause_summary}",
                f"  Suggested fix: {group.suggested_fixes[0]}",
                f"  Flaky suspected: {'yes' if group.flaky else 'no'}",
            ]
        )
        if group.flaky_signals:
            lines.append(f"  Flaky signal: {group.flaky_signals[0].detail}")
        if include_evidence and group.evidence:
            excerpt = _single_line(group.evidence[0].excerpt)
            lines.append(f"  Evidence: `{excerpt}`")

    if artifact.unavailable_log_notes:
        unavailable = ", ".join(
            _unavailable_label(note.name, note.reason)
            for note in artifact.unavailable_log_notes[:3]
        )
        suffix = "" if len(artifact.unavailable_log_notes) <= 3 else f", +{len(artifact.unavailable_log_notes) - 3} more"
        lines.extend(["", f"Unavailable logs: {unavailable}{suffix}."])

    return "\n".join(lines).strip()


def classify_flaky_signals(text: str) -> tuple[FlakySignal, ...]:
    lines = [_clean_line(line) for line in text.splitlines()]
    signals: list[FlakySignal] = []
    seen: set[str] = set()

    for signal, confidence, patterns in _FLAKY_PATTERNS:
        matched_line = _first_matching_line(lines, patterns)
        if matched_line is None or signal in seen:
            continue
        signals.append(
            FlakySignal(
                signal=signal,
                detail=f"{_signal_label(signal)}: {_bounded(matched_line, 180)}",
                confidence=confidence,
            )
        )
        seen.add(signal)

    return tuple(signals)


def _coerce_ci_log_artifact(value: CiLogArtifact | Mapping[str, Any]) -> CiLogArtifact:
    if isinstance(value, CiLogArtifact):
        return value
    return CiLogArtifact.from_mapping(value)


def _coerce_ci_failure_explanation(value: CiFailureExplanationArtifact | Mapping[str, Any]) -> CiFailureExplanationArtifact:
    if isinstance(value, CiFailureExplanationArtifact):
        return value
    return CiFailureExplanationArtifact.from_mapping(value)


def _failure_segments(content: str) -> list[_StepSegment]:
    segments = _split_step_segments(content)
    selected = [segment for segment in segments if _failure_line_indexes(segment.lines)]

    if selected:
        return selected

    tail_lines = tuple(_clean_line(line) for line in content.splitlines()[-12:] if _clean_line(line))
    return [_StepSegment(name=None, lines=tail_lines)] if tail_lines else []


def _split_step_segments(content: str) -> list[_StepSegment]:
    segments: list[_StepSegment] = []
    current_name: str | None = None
    current_lines: list[str] = []

    for raw_line in content.splitlines():
        line = _clean_line(raw_line)
        if not line:
            continue

        step_name = _read_step_name(line)
        if step_name is not None:
            if current_lines:
                segments.append(_StepSegment(current_name, tuple(current_lines)))
            current_name = step_name
            current_lines = [line]
            continue

        current_lines.append(line)

    if current_lines:
        segments.append(_StepSegment(current_name, tuple(current_lines)))

    return segments


def _read_step_name(line: str) -> str | None:
    normalized = _strip_log_prefix(line)
    match = _STEP_GROUP_RE.match(normalized)
    if match:
        return _bounded(match.group(1).strip(), 120)

    match = _GENERIC_GROUP_RE.match(normalized)
    if match:
        value = match.group(1).strip()
        return _bounded(value, 120) if value else None

    return None


def _failure_line_indexes(lines: Sequence[str]) -> tuple[int, ...]:
    indexes: list[int] = []
    for index, line in enumerate(lines):
        normalized = _strip_log_prefix(line)
        if _TSC_ERROR_RE.search(normalized) or any(pattern.search(normalized) for pattern in _FAILURE_PATTERNS):
            indexes.append(index)
    return tuple(indexes)


def _failure_excerpt(lines: Sequence[str]) -> str:
    indexes = _failure_line_indexes(lines)
    if not indexes:
        return _bounded("\n".join(lines[-8:]), 1200)

    selected: set[int] = set()
    for index in indexes:
        for offset in (-1, 0, 1):
            candidate = index + offset
            if 0 <= candidate < len(lines):
                selected.add(candidate)

    ordered = sorted(selected)
    excerpt_lines: list[str] = []
    previous: int | None = None
    for index in ordered:
        if previous is not None and index > previous + 1:
            excerpt_lines.append("...")
        excerpt_lines.append(_strip_log_prefix(lines[index]))
        previous = index

    return _bounded("\n".join(excerpt_lines[:12]), 1200)


def _classify_category(*, conclusion: str, text: str, step_name: str | None) -> str:
    haystack = f"{step_name or ''}\n{text}"
    if conclusion in {"cancelled", "canceled", "stale"}:
        return "cancellation"
    if conclusion in {"timed_out", "startup_failure"}:
        return "timeout"

    for category, patterns in _CATEGORY_PATTERNS:
        if _first_matching_line(haystack.splitlines(), patterns) is not None:
            return category

    return "unknown"


def _root_cause_summary(
    *,
    job_name: str,
    step_name: str | None,
    category: str,
    excerpt: str,
    flaky_signals: Sequence[FlakySignal],
) -> str:
    step_label = f" in step `{step_name}`" if step_name else ""
    detail = _best_error_line(excerpt)
    category_label = {
        "test_failure": "test failure",
        "build_failure": "build failure",
        "dependency_failure": "dependency/setup failure",
        "lint_failure": "lint failure",
        "typecheck_failure": "typecheck failure",
        "timeout": "timeout",
        "cancellation": "cancellation",
        "infrastructure": "runner or external service failure",
        "unknown": "failure",
    }[category]

    summary = f"The {job_name} job failed{step_label} with a {category_label}"
    if detail:
        summary += f" because the log reports: {_trim_sentence(detail)}."
    else:
        summary += "."

    if flaky_signals:
        summary += f" This may be flaky because {flaky_signals[0].detail.lower()}."

    return summary


def _suggested_fixes(*, category: str, step_name: str | None, flaky: bool) -> list[str]:
    fixes: list[str] = []
    command = _step_command(step_name)
    if command:
        fixes.append(f"Reproduce the failing command locally: `{command}`.")

    if category == "test_failure":
        fixes.append("Inspect the failing assertion and update either the changed behavior or the expected value.")
    elif category == "dependency_failure":
        fixes.append("Restore the missing dependency, install step, or lockfile entry before rerunning CI.")
    elif category == "lint_failure":
        fixes.append("Run the project lint command locally and fix the reported formatting or lint rule violations.")
    elif category == "typecheck_failure":
        fixes.append("Run the typecheck locally and align the changed types with the reported compiler error.")
    elif category == "timeout":
        fixes.append("Check for hung tests or long-running setup, then add deterministic waits, timeouts, or test isolation.")
    elif category == "infrastructure":
        fixes.append("Check runner/network health and retry once before changing code if the service failure is external.")
    elif category == "build_failure":
        fixes.append("Run the build locally and fix the first compiler or bundler error shown in the log.")
    elif category == "cancellation":
        fixes.append("Confirm whether the run was superseded or manually cancelled before rerunning the failed job.")
    else:
        fixes.append("Open the failed step log and fix the first actionable error before rerunning CI.")

    if flaky:
        fixes.append("Rerun the failed job once; if it passes, harden or quarantine the unstable test instead of masking it.")

    return _dedupe_keep_order(fixes)


def _fallback_groups_for_logs(
    artifact: CiLogArtifact,
    check_runs: Mapping[int, Any],
) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []
    for log in artifact.logs:
        check_run = check_runs.get(log.check_run_id)
        job_name = check_run.name if check_run is not None else log.name
        conclusion = check_run.conclusion if check_run is not None else "failure"
        excerpt = _failure_excerpt(tuple(_clean_line(line) for line in log.content.splitlines() if _clean_line(line)))
        category = _classify_category(conclusion=conclusion, text=excerpt, step_name=None)
        flaky_signals = classify_flaky_signals(excerpt)
        groups.append(
            {
                "id": _group_id(log.check_run_id, job_name, excerpt),
                "jobName": job_name,
                "checkRunId": log.check_run_id,
                "conclusion": conclusion,
                "stepName": None,
                "category": category,
                "rootCauseSummary": _root_cause_summary(
                    job_name=job_name,
                    step_name=None,
                    category=category,
                    excerpt=excerpt,
                    flaky_signals=flaky_signals,
                ),
                "suggestedFixes": _suggested_fixes(category=category, step_name=None, flaky=bool(flaky_signals)),
                "flaky": bool(flaky_signals),
                "flakySignals": [_flaky_signal_payload(signal) for signal in flaky_signals],
                "evidence": [
                    {
                        "checkRunId": log.check_run_id,
                        "workflowJobId": log.workflow_job_id,
                        "stepName": None,
                        "excerpt": excerpt,
                    }
                ],
            }
        )
    return groups


def _summary(*, groups: Sequence[Mapping[str, Any]], unavailable_logs: Sequence[Any]) -> str:
    if groups:
        job_count = len({group["checkRunId"] for group in groups})
        group_word = "group" if len(groups) == 1 else "groups"
        job_word = "job" if job_count == 1 else "jobs"
        return (
            f"Found {len(groups)} CI failure {group_word} across {job_count} failed {job_word}. "
            f"Most likely: {groups[0]['rootCauseSummary']}"
        )

    if unavailable_logs:
        note_count = len(unavailable_logs)
        note_word = "log was" if note_count == 1 else "logs were"
        return f"CI failed, but {note_count} failed job {note_word} unavailable for analysis."

    return "No failed CI logs were available for analysis."


def _best_error_line(excerpt: str) -> str:
    lines = [_strip_log_prefix(line) for line in excerpt.splitlines()]
    priority_patterns = (
        re.compile(r"\bAssertionError\b", re.IGNORECASE),
        re.compile(r"\bTimeoutError\b", re.IGNORECASE),
        re.compile(r"\bCannot find module\b", re.IGNORECASE),
        re.compile(r"\bModuleNotFoundError\b", re.IGNORECASE),
        re.compile(r"\bImportError\b", re.IGNORECASE),
        _TSC_ERROR_RE,
        re.compile(r"\bnpm ERR!", re.IGNORECASE),
        re.compile(r"\bError:", re.IGNORECASE),
    )
    for line in lines:
        cleaned = line.replace("##[error]", "").strip()
        if cleaned and any(pattern.search(cleaned) for pattern in priority_patterns):
            return _bounded(cleaned, 220)

    for line in lines:
        if _PROCESS_EXIT_RE.search(line):
            continue
        if _TSC_ERROR_RE.search(line) or any(pattern.search(line) for pattern in _FAILURE_PATTERNS):
            cleaned = line.replace("##[error]", "").strip()
            if cleaned and not _PROCESS_EXIT_RE.search(cleaned):
                return _bounded(cleaned, 220)
    return _bounded(next((line for line in lines if line.strip()), ""), 220)


def _first_matching_line(lines: Sequence[str], patterns: Sequence[re.Pattern[str]]) -> str | None:
    for line in lines:
        cleaned = _strip_log_prefix(line)
        if any(pattern.search(cleaned) for pattern in patterns):
            return cleaned
    return None


def _flaky_signal_payload(signal: FlakySignal) -> dict[str, Any]:
    return {
        "signal": signal.signal,
        "detail": signal.detail,
        "confidence": signal.confidence,
    }


def _signal_label(signal: str) -> str:
    return signal.replace("_", " ")


def _group_id(check_run_id: int, step_name: str, excerpt: str) -> str:
    digest = hashlib.sha256(f"{check_run_id}\0{step_name}\0{excerpt}".encode("utf-8")).hexdigest()[:12]
    slug = re.sub(r"[^a-z0-9]+", "-", step_name.casefold()).strip("-")[:48] or "job"
    return f"ci:{check_run_id}:{slug}:{digest}"


def _step_command(step_name: str | None) -> str | None:
    if step_name is None:
        return None
    command = step_name.strip()
    return _bounded(command, 120) if command else None


def _clean_line(line: str) -> str:
    return _ANSI_ESCAPE_RE.sub("", line).rstrip()


def _strip_log_prefix(line: str) -> str:
    return _TIMESTAMP_PREFIX_RE.sub("", line).strip()


def _single_line(value: str) -> str:
    return _bounded(" | ".join(line.strip() for line in value.splitlines() if line.strip()), 220)


def _trim_sentence(value: str) -> str:
    return value.rstrip(".")


def _unavailable_label(name: str | None, reason: str) -> str:
    return f"`{name}` ({reason})" if name else reason


def _dedupe_keep_order(values: Sequence[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        if value in seen:
            continue
        deduped.append(value)
        seen.add(value)
    return deduped


def _bounded(value: str, limit: int) -> str:
    normalized = value.strip()
    if len(normalized) <= limit:
        return normalized
    return normalized[: max(1, limit - 3)].rstrip() + "..."
