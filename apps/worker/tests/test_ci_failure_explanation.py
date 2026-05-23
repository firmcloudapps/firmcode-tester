from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping

from firmcode_worker.ci import (
    classify_flaky_signals,
    generate_ci_failure_explanation,
    render_ci_failure_explanation_markdown,
)
from firmcode_worker.schemas.contracts import CiFailureExplanationArtifact, CiLogArtifact


FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "ci_logs"


def read_fixture(name: str) -> Mapping[str, Any]:
    return json.loads((FIXTURE_DIR / name).read_text())


def test_ci_failure_explanation_groups_failures_by_job_and_step() -> None:
    actual = generate_ci_failure_explanation(read_fixture("node-test-failure.input.json"))
    parsed = CiFailureExplanationArtifact.from_mapping(actual)

    assert parsed.summary.startswith("Found 1 CI failure group across 1 failed job.")
    assert len(parsed.groups) == 1
    assert parsed.groups[0].job_name == "unit tests"
    assert parsed.groups[0].step_name == "npm test"
    assert parsed.groups[0].category == "test_failure"
    assert parsed.groups[0].flaky is False
    assert "AssertionError: expected 201 to equal 200" in parsed.groups[0].root_cause_summary
    assert "src/pricing.test.ts" in parsed.groups[0].evidence[0].excerpt


def test_ci_failure_explanation_renders_publishable_summary_markdown() -> None:
    actual = generate_ci_failure_explanation(read_fixture("flaky-service-timeout.input.json"))
    markdown = render_ci_failure_explanation_markdown(actual)

    assert "`integration tests` / `pytest apps/api/tests/test_webhook.py`" in markdown
    assert "Flaky suspected: yes" in markdown
    assert "Unavailable logs: `deploy preview` (missing_actions_permission)." in markdown


def test_golden_ci_log_explanation_fixtures_match_expected_output() -> None:
    for fixture_name in ("node-test-failure", "flaky-service-timeout"):
        actual = generate_ci_failure_explanation(read_fixture(f"{fixture_name}.input.json"))
        expected = read_fixture(f"{fixture_name}.expected.json")

        assert actual == expected
        CiFailureExplanationArtifact.from_mapping(actual)


def test_ci_log_contract_model_accepts_generated_explanation() -> None:
    ci_log = CiLogArtifact.from_mapping(read_fixture("node-test-failure.input.json"))
    actual = generate_ci_failure_explanation(ci_log)
    parsed = CiFailureExplanationArtifact.from_mapping(actual)

    assert parsed.review_run_id == ci_log.review_run_id
    assert parsed.repository_full_name == ci_log.repository_full_name


def test_flaky_classifier_detects_common_flaky_signals() -> None:
    signals = classify_flaky_signals(
        "\n".join(
            [
                "TimeoutError: waited 30000ms for background worker",
                "ECONNRESET while calling local service",
                "random seed 772 caused order-dependent assertion",
                "Killed process after runner reported out of memory",
            ]
        )
    )

    assert {signal.signal for signal in signals} >= {
        "timeout",
        "network_or_service",
        "concurrency_or_order",
        "runner_resource",
    }


def test_flaky_classifier_ignores_deterministic_assertion_failures() -> None:
    signals = classify_flaky_signals(
        "\n".join(
            [
                "FAIL src/pricing.test.ts",
                "AssertionError: expected 201 to equal 200",
                "Process completed with exit code 1.",
            ]
        )
    )

    assert signals == ()
