from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any, Mapping

import pytest

from firmcode_worker.review import LlmEvaluationExpectations, evaluate_frozen_llm_review
from firmcode_worker.schemas.contracts import DiffArtifact, SemgrepArtifact


FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "llm_evaluation" / "golden-fixtures.json"
EXPECTED_CASES = {
    "small-bug-pr",
    "security-finding-pr",
    "infrastructure-pr",
    "ci-failure-pr",
    "large-pr",
    "generated-file-heavy-pr",
    "no-issue-pr",
}


def _read_manifest() -> Mapping[str, Any]:
    return json.loads(FIXTURE_PATH.read_text())


def test_llm_evaluation_fixture_manifest_covers_strategy_cases() -> None:
    manifest = _read_manifest()

    assert manifest["schemaVersion"] == "llm-evaluation-fixtures/v1"
    assert {case["name"] for case in manifest["cases"]} == EXPECTED_CASES


@pytest.mark.parametrize("case", _read_manifest()["cases"], ids=lambda case: case["name"])
def test_golden_llm_evaluation_fixture_passes_deterministic_checks(case: Mapping[str, Any]) -> None:
    result = _evaluate_case(case)

    assert result.errors == ()
    assert result.passed is True


def test_llm_evaluation_reports_policy_violations() -> None:
    case = deepcopy(next(case for case in _read_manifest()["cases"] if case["name"] == "small-bug-pr"))
    case["frozenResponse"]["inlineFindings"][0]["severity"] = "critical"

    result = _evaluate_case(case)

    assert any("exceeds fixture max" in error for error in result.errors)


def _evaluate_case(case: Mapping[str, Any]):
    semgrep_artifact = case.get("semgrepArtifact")
    return evaluate_frozen_llm_review(
        frozen_response=case["frozenResponse"],
        diff_artifact=DiffArtifact.from_mapping(case["diffArtifact"]),
        semgrep_artifact=SemgrepArtifact.from_mapping(semgrep_artifact) if semgrep_artifact is not None else None,
        expectations=LlmEvaluationExpectations.from_mapping(case["expectations"]),
    )
