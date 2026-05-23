from __future__ import annotations

import asyncio
import json
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

import pytest

from firmcode_worker.llm import (
    FakeLLMClient,
    LLMInvalidJsonError,
    LLMMessage,
    LLMRequestOptions,
    LLMStructuredResponse,
    LLMTokenUsage,
)
from firmcode_worker.review import (
    LlmReviewOutputValidationError,
    complete_validated_review_output,
    validate_and_prepare_review_output,
)
from firmcode_worker.schemas.contracts import DiffArtifact, LlmReviewOutput, SemgrepArtifact


FIXTURE_DIR = Path(__file__).parent / "fixtures" / "llm_output"
SCHEMA: Mapping[str, Any] = {"type": "object", "required": ["schemaVersion", "inlineFindings"]}


class InvalidJsonThenRepairClient:
    def __init__(self, repaired: Mapping[str, Any]) -> None:
        self.repaired = repaired
        self.complete_calls = 0
        self.repair_calls = 0

    async def complete_structured(
        self,
        prompt: str | Sequence[LLMMessage],
        schema: Mapping[str, Any],
        options: LLMRequestOptions,
    ) -> LLMStructuredResponse:
        _ = (prompt, schema, options)
        self.complete_calls += 1
        raise LLMInvalidJsonError("broken json", raw_content='{"schemaVersion": "llm-review-output/v1"')

    async def repair_structured_output(
        self,
        raw: str,
        schema: Mapping[str, Any],
        options: LLMRequestOptions,
    ) -> LLMStructuredResponse:
        _ = (raw, schema, options)
        self.repair_calls += 1
        return _structured_response(self.repaired)

    def estimate_cost(self, usage: LLMTokenUsage, *, model: str) -> Any:
        _ = (usage, model)
        return None


def test_invalid_json_triggers_one_repair_attempt_then_validates_schema() -> None:
    client = InvalidJsonThenRepairClient(_read_json("llm-duplicate-output.json"))
    result = asyncio.run(
        complete_validated_review_output(
            client=client,
            prompt="review",
            schema=SCHEMA,
            options=LLMRequestOptions(model="review-model"),
            diff_artifact=_diff_fixture(),
        )
    )

    assert result.repaired is True
    assert client.complete_calls == 1
    assert client.repair_calls == 1
    assert result.output.summary == "The PR adds shell execution and should be constrained."


def test_invalid_schema_repairs_once_and_fails_safely_when_repair_is_invalid() -> None:
    invalid = _valid_output()
    invalid["inlineFindings"][0]["evidence"] = []
    client = FakeLLMClient([invalid, invalid])

    with pytest.raises(LlmReviewOutputValidationError) as error:
        asyncio.run(
            complete_validated_review_output(
                client=client,
                prompt="review",
                schema=SCHEMA,
                options=LLMRequestOptions(model="review-model"),
                diff_artifact=_diff_fixture(),
            )
        )

    assert "evidence" in str(error.value.validation_errors)
    assert len(client.requests) == 2


def test_inline_findings_outside_changed_lines_are_downgraded_to_summary_findings() -> None:
    payload = _valid_output()
    payload["inlineFindings"][0]["id"] = "unchanged-line"
    payload["inlineFindings"][0]["path"] = "src/server.ts"
    payload["inlineFindings"][0]["lineRange"] = {"startLine": 44, "endLine": 44}
    payload["inlineFindings"][0]["evidence"][0]["lineRange"] = {"startLine": 44, "endLine": 44}
    output = LlmReviewOutput.from_mapping(payload)

    result = validate_and_prepare_review_output(output, diff_artifact=_diff_fixture())

    assert [finding.id for finding in result.output.inline_findings] == ["llm-context-finding"]
    assert [finding.id for finding in result.output.summary_findings] == ["unchanged-line"]
    assert result.output.summary_findings[0].line_range is None
    assert result.downgraded_inline_finding_ids == ("unchanged-line",)


def test_deduplication_fixture_collapses_semgrep_and_llm_duplicates() -> None:
    output = LlmReviewOutput.from_mapping(_read_json("llm-duplicate-output.json"))
    result = validate_and_prepare_review_output(
        output,
        diff_artifact=_diff_fixture(),
        semgrep_artifact=SemgrepArtifact.from_mapping(_read_json("semgrep-duplicate.json")),
    )

    assert [finding.id for finding in result.output.inline_findings] == [
        "semgrep:typescript.security.audit:src/server.ts:42",
        "llm-context-finding",
    ]
    assert result.output.inline_findings[0].source == "semgrep"
    assert result.deduplicated_finding_ids == ("llm-duplicate-shell",)


def _read_json(name: str) -> dict[str, Any]:
    return json.loads((FIXTURE_DIR / name).read_text())


def _diff_fixture() -> DiffArtifact:
    return DiffArtifact.from_mapping(_read_json("diff-artifact.changed-lines.json"))


def _valid_output() -> dict[str, Any]:
    return _read_json("llm-duplicate-output.json")


def _structured_response(content: Mapping[str, Any]) -> LLMStructuredResponse:
    return LLMStructuredResponse(
        content=content,
        raw_content=json.dumps(content, sort_keys=True),
        model="review-model",
        usage=LLMTokenUsage(),
        latency_ms=0,
        attempts=1,
        finish_reason="stop",
    )
