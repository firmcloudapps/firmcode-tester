from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from firmcode_worker.schemas.contracts import DiffArtifact, LlmReviewOutput, ReviewFinding, SemgrepArtifact

from .output_validation import ReviewOutputValidationResult, validate_and_prepare_review_output


SEVERITY_RANK = {
    "info": 0,
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}


@dataclass(frozen=True)
class LlmEvaluationExpectations:
    prompt_id: str
    prompt_version: str
    schema_version: str
    max_inline_comments: int
    max_severity: str
    required_semgrep_finding_ids: tuple[str, ...] = ()

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "LlmEvaluationExpectations":
        required_ids = value.get("requiredSemgrepFindingIds", [])
        if not isinstance(required_ids, list) or not all(isinstance(item, str) for item in required_ids):
            raise ValueError("requiredSemgrepFindingIds must be an array of strings")

        return cls(
            prompt_id=_read_str(value, "promptId"),
            prompt_version=_read_str(value, "promptVersion"),
            schema_version=_read_str(value, "schemaVersion"),
            max_inline_comments=_read_int(value, "maxInlineComments"),
            max_severity=_read_str(value, "maxSeverity"),
            required_semgrep_finding_ids=tuple(required_ids),
        )


@dataclass(frozen=True)
class LlmEvaluationResult:
    prepared_output: ReviewOutputValidationResult
    errors: tuple[str, ...]

    @property
    def passed(self) -> bool:
        return not self.errors


def evaluate_frozen_llm_review(
    *,
    frozen_response: Mapping[str, Any],
    diff_artifact: DiffArtifact,
    expectations: LlmEvaluationExpectations,
    semgrep_artifact: SemgrepArtifact | None = None,
) -> LlmEvaluationResult:
    output = LlmReviewOutput.from_mapping(frozen_response)
    prepared = validate_and_prepare_review_output(
        output,
        diff_artifact=diff_artifact,
        semgrep_artifact=semgrep_artifact,
    )

    errors = [
        *_check_prompt_metadata(output, expectations),
        *_check_changed_line_inline_findings(prepared),
        *_check_comment_count(prepared, expectations),
        *_check_severity_restraint(prepared, expectations),
        *_check_evidence(prepared.output.inline_findings, "inlineFindings"),
        *_check_evidence(prepared.output.summary_findings, "summaryFindings"),
        *_check_semgrep_preservation(prepared, expectations, semgrep_artifact),
    ]

    return LlmEvaluationResult(prepared_output=prepared, errors=tuple(errors))


def _check_prompt_metadata(
    output: LlmReviewOutput,
    expectations: LlmEvaluationExpectations,
) -> list[str]:
    errors: list[str] = []
    if output.prompt_id != expectations.prompt_id:
        errors.append(f"promptId {output.prompt_id!r} does not match expected {expectations.prompt_id!r}")
    if output.prompt_version != expectations.prompt_version:
        errors.append(
            f"promptVersion {output.prompt_version!r} does not match expected {expectations.prompt_version!r}"
        )
    if output.schema_version != expectations.schema_version:
        errors.append(
            f"schemaVersion {output.schema_version!r} does not match expected {expectations.schema_version!r}"
        )
    return errors


def _check_changed_line_inline_findings(result: ReviewOutputValidationResult) -> list[str]:
    if not result.downgraded_inline_finding_ids:
        return []
    return [
        "inline findings must target changed lines; downgraded: "
        + ", ".join(result.downgraded_inline_finding_ids)
    ]


def _check_comment_count(
    result: ReviewOutputValidationResult,
    expectations: LlmEvaluationExpectations,
) -> list[str]:
    actual = len(result.output.inline_findings)
    if actual <= expectations.max_inline_comments:
        return []
    return [f"inline comment count {actual} exceeds max {expectations.max_inline_comments}"]


def _check_severity_restraint(
    result: ReviewOutputValidationResult,
    expectations: LlmEvaluationExpectations,
) -> list[str]:
    max_rank = SEVERITY_RANK.get(expectations.max_severity)
    if max_rank is None:
        return [f"unknown max severity {expectations.max_severity!r}"]

    errors: list[str] = []
    for finding in [*result.output.inline_findings, *result.output.summary_findings]:
        severity_rank = SEVERITY_RANK.get(finding.severity)
        if severity_rank is None:
            errors.append(f"{finding.id} has unknown severity {finding.severity!r}")
        elif severity_rank > max_rank:
            errors.append(
                f"{finding.id} severity {finding.severity!r} exceeds fixture max {expectations.max_severity!r}"
            )
    return errors


def _check_evidence(findings: Sequence[ReviewFinding], label: str) -> list[str]:
    errors: list[str] = []
    for index, finding in enumerate(findings):
        if not finding.evidence:
            errors.append(f"{label}[{index}] {finding.id} has no evidence")
    return errors


def _check_semgrep_preservation(
    result: ReviewOutputValidationResult,
    expectations: LlmEvaluationExpectations,
    semgrep_artifact: SemgrepArtifact | None,
) -> list[str]:
    findings_by_id = {
        finding.id: finding
        for finding in [*result.output.inline_findings, *result.output.summary_findings]
    }
    errors: list[str] = []
    semgrep_ids = {finding.id for finding in semgrep_artifact.findings} if semgrep_artifact is not None else set()
    required_ids = sorted(semgrep_ids | set(expectations.required_semgrep_finding_ids))
    for finding_id in required_ids:
        finding = findings_by_id.get(finding_id)
        if finding is None:
            errors.append(f"Semgrep finding {finding_id!r} was not preserved")
        elif finding.source != "semgrep":
            errors.append(f"Semgrep finding {finding_id!r} was preserved with source {finding.source!r}")
    return errors


def _read_str(value: Mapping[str, Any], key: str) -> str:
    actual = value.get(key)
    if isinstance(actual, str) and actual:
        return actual
    raise ValueError(f"{key} must be a non-empty string")


def _read_int(value: Mapping[str, Any], key: str) -> int:
    actual = value.get(key)
    if isinstance(actual, int) and not isinstance(actual, bool) and actual >= 0:
        return actual
    raise ValueError(f"{key} must be a non-negative integer")
