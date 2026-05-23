from __future__ import annotations

import hashlib
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from typing import Any

from firmcode_worker.llm import LLMClient, LLMClientError, LLMInvalidJsonError, LLMMessage, LLMRequestOptions
from firmcode_worker.schemas.contracts import (
    ContractValidationError,
    DiffArtifact,
    FindingEvidence,
    LineRange,
    LlmReviewOutput,
    ReviewFinding,
    SemgrepArtifact,
    SemgrepFinding,
)


class LlmReviewOutputValidationError(LLMClientError):
    def __init__(self, message: str, *, validation_errors: Sequence[str] = ()) -> None:
        super().__init__(message)
        self.validation_errors = tuple(validation_errors)


@dataclass(frozen=True)
class ReviewOutputValidationResult:
    output: LlmReviewOutput
    repaired: bool
    downgraded_inline_finding_ids: tuple[str, ...]
    deduplicated_finding_ids: tuple[str, ...]


async def complete_validated_review_output(
    *,
    client: LLMClient,
    prompt: str | Sequence[LLMMessage],
    schema: Mapping[str, Any],
    options: LLMRequestOptions,
    diff_artifact: DiffArtifact,
    semgrep_artifact: SemgrepArtifact | None = None,
) -> ReviewOutputValidationResult:
    try:
        response = await client.complete_structured(prompt, schema, options)
        output = _parse_review_output(response.content)
        repaired = False
    except LLMInvalidJsonError as error:
        output = await _repair_once(client=client, raw=error.raw_content, schema=schema, options=options)
        repaired = True
    except ContractValidationError as error:
        raw = getattr(locals().get("response", None), "raw_content", "")
        output = await _repair_once(client=client, raw=raw, schema=schema, options=options, original_errors=error.errors)
        repaired = True

    prepared = validate_and_prepare_review_output(
        output,
        diff_artifact=diff_artifact,
        semgrep_artifact=semgrep_artifact,
    )
    return replace(prepared, repaired=repaired)


def validate_and_prepare_review_output(
    output: LlmReviewOutput,
    *,
    diff_artifact: DiffArtifact,
    semgrep_artifact: SemgrepArtifact | None = None,
) -> ReviewOutputValidationResult:
    changed_lines = _changed_line_index(diff_artifact)
    semgrep_findings = [
        _semgrep_to_review_finding(finding)
        for finding in (semgrep_artifact.findings if semgrep_artifact is not None else [])
    ]

    inline_candidates = [*semgrep_findings, *output.inline_findings]
    summary_candidates = list(output.summary_findings)
    inline_findings: list[ReviewFinding] = []
    summary_findings: list[ReviewFinding] = []
    downgraded_ids: list[str] = []

    for finding in inline_candidates:
        if _is_changed_line_finding(finding, changed_lines):
            inline_findings.append(finding)
        else:
            summary_findings.append(_summary_version(finding))
            downgraded_ids.append(finding.id)

    summary_findings.extend(summary_candidates)

    inline_findings, inline_deduped = _dedupe_findings(inline_findings)
    summary_findings, summary_deduped = _dedupe_findings(summary_findings, existing=inline_findings)

    prepared_output = replace(
        output,
        inline_findings=inline_findings,
        summary_findings=summary_findings,
    )
    return ReviewOutputValidationResult(
        output=prepared_output,
        repaired=False,
        downgraded_inline_finding_ids=tuple(downgraded_ids),
        deduplicated_finding_ids=tuple([*inline_deduped, *summary_deduped]),
    )


async def _repair_once(
    *,
    client: LLMClient,
    raw: str,
    schema: Mapping[str, Any],
    options: LLMRequestOptions,
    original_errors: Sequence[str] = (),
) -> LlmReviewOutput:
    repair_input = raw or f"Model output failed schema validation: {'; '.join(original_errors)}"
    try:
        response = await client.repair_structured_output(repair_input, schema, options)
        return _parse_review_output(response.content)
    except LLMInvalidJsonError as error:
        raise LlmReviewOutputValidationError(
            "LLM repair response was not valid JSON.",
            validation_errors=(str(error),),
        ) from error
    except ContractValidationError as error:
        raise LlmReviewOutputValidationError(
            "LLM repair response did not match the review output schema.",
            validation_errors=error.errors,
        ) from error
    except LLMClientError as error:
        raise LlmReviewOutputValidationError(
            "LLM repair attempt failed.",
            validation_errors=(str(error),),
        ) from error


def _parse_review_output(value: Mapping[str, Any]) -> LlmReviewOutput:
    return LlmReviewOutput.from_mapping(value)


def _changed_line_index(diff_artifact: DiffArtifact) -> dict[str, set[int]]:
    return {
        file.path: set(file.changed_new_lines)
        for file in diff_artifact.files
    }


def _is_changed_line_finding(finding: ReviewFinding, changed_lines: Mapping[str, set[int]]) -> bool:
    if finding.path is None or finding.line_range is None:
        return False

    eligible_lines = changed_lines.get(finding.path)
    if not eligible_lines:
        return False

    start = finding.line_range.start_line
    end = finding.line_range.end_line
    if start > end:
        return False

    return all(line in eligible_lines for line in range(start, end + 1))


def _summary_version(finding: ReviewFinding) -> ReviewFinding:
    return replace(finding, path=finding.path, line_range=None)


def _dedupe_findings(
    findings: Sequence[ReviewFinding],
    *,
    existing: Sequence[ReviewFinding] = (),
) -> tuple[list[ReviewFinding], list[str]]:
    selected: list[ReviewFinding] = []
    exact_keys: dict[tuple[str, str, int | None, str, str], int] = {}
    cross_source_keys: dict[tuple[str, int | None, str, str], int] = {}
    deduped_ids: list[str] = []

    for finding in existing:
        exact_keys[_exact_key(finding)] = -1
        cross_source_keys[_cross_source_key(finding)] = -1

    for finding in findings:
        exact_key = _exact_key(finding)
        cross_source_key = _cross_source_key(finding)
        duplicate_index = exact_keys.get(exact_key, cross_source_keys.get(cross_source_key))

        if duplicate_index is None:
            exact_keys[exact_key] = len(selected)
            cross_source_keys[cross_source_key] = len(selected)
            selected.append(finding)
            continue

        deduped_ids.append(finding.id)
        if duplicate_index >= 0 and _should_replace(selected[duplicate_index], finding):
            selected[duplicate_index] = _merge_evidence(finding, selected[duplicate_index])
            exact_keys[exact_key] = duplicate_index
            cross_source_keys[cross_source_key] = duplicate_index

    return selected, deduped_ids


def _exact_key(finding: ReviewFinding) -> tuple[str, str, int | None, str, str]:
    return (
        finding.source,
        finding.path or "",
        _finding_line(finding),
        _normalized_text(finding.title),
        _evidence_hash(finding.evidence),
    )


def _cross_source_key(finding: ReviewFinding) -> tuple[str, int | None, str, str]:
    return (
        finding.path or "",
        _finding_line(finding),
        _normalized_text(finding.title),
        _evidence_hash(finding.evidence),
    )


def _finding_line(finding: ReviewFinding) -> int | None:
    if finding.line_range is None:
        return None
    return finding.line_range.start_line


def _evidence_hash(evidence: Sequence[FindingEvidence]) -> str:
    hasher = hashlib.sha256()
    for item in sorted(evidence, key=_evidence_sort_key):
        hasher.update((item.source or "").encode("utf-8"))
        hasher.update(b"\0")
        hasher.update((item.path or "").encode("utf-8"))
        hasher.update(b"\0")
        hasher.update(str(item.line_range.start_line if item.line_range else "").encode("utf-8"))
        hasher.update(b":")
        hasher.update(str(item.line_range.end_line if item.line_range else "").encode("utf-8"))
        hasher.update(b"\0")
        hasher.update(_normalized_text(item.excerpt).encode("utf-8"))
        hasher.update(b"\0")
    return hasher.hexdigest()


def _evidence_sort_key(item: FindingEvidence) -> tuple[str, str, int, int, str]:
    line_range = item.line_range
    return (
        item.source,
        item.path or "",
        line_range.start_line if line_range else 0,
        line_range.end_line if line_range else 0,
        _normalized_text(item.excerpt),
    )


def _normalized_text(value: str) -> str:
    return " ".join(value.casefold().split())


def _should_replace(current: ReviewFinding, candidate: ReviewFinding) -> bool:
    if current.source != "semgrep" and candidate.source == "semgrep":
        return True
    if current.source == "semgrep" and candidate.source != "semgrep":
        return False
    return candidate.confidence > current.confidence


def _merge_evidence(preferred: ReviewFinding, duplicate: ReviewFinding) -> ReviewFinding:
    evidence = list(preferred.evidence)
    seen = {_evidence_sort_key(item) for item in evidence}
    for item in duplicate.evidence:
        key = _evidence_sort_key(item)
        if key not in seen:
            evidence.append(item)
            seen.add(key)
    return replace(preferred, evidence=evidence)


def _semgrep_to_review_finding(finding: SemgrepFinding) -> ReviewFinding:
    line_range = LineRange(start_line=finding.start.line, end_line=finding.end.line)
    category = str(finding.metadata.get("category") or "security")
    if category not in {
        "bug",
        "security",
        "performance",
        "maintainability",
        "testing",
        "ci",
        "infrastructure",
        "documentation",
    }:
        category = "security"

    return ReviewFinding(
        id=finding.id,
        source="semgrep",
        category=category,
        severity=finding.severity,
        confidence=0.95,
        path=finding.path,
        line_range=line_range,
        title=finding.message,
        body=finding.message,
        evidence=[
            FindingEvidence(
                source="semgrep",
                artifact_id=finding.id,
                path=finding.path,
                line_range=line_range,
                excerpt=finding.lines or finding.message,
            )
        ],
        suggested_fix=finding.fix,
    )
