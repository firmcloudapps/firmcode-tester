from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping

import pytest

from firmcode_worker.schemas.contracts import (
    ContractValidationError,
    CiFailureExplanationArtifact,
    CiLogArtifact,
    CodebaseScanArtifactMetadata,
    CodebaseScanFinding,
    CodebaseScanJobInput,
    CodebaseScanReviewEnrichment,
    DiffArtifact,
    LlmReviewOutput,
    PublishPayload,
    ReviewJobInput,
    SemgrepArtifact,
    TreeSitterArtifact,
)


FIXTURE_DIR = Path(__file__).resolve().parents[3] / "packages" / "shared" / "test" / "fixtures" / "worker-contracts"


def read_fixture(name: str) -> Mapping[str, Any]:
    return json.loads((FIXTURE_DIR / name).read_text())


@pytest.mark.parametrize(
    ("model", "fixture_name"),
    [
        (ReviewJobInput, "review-job-input.v1.json"),
        (DiffArtifact, "diff-artifact.v1.json"),
        (SemgrepArtifact, "semgrep-artifact.v1.json"),
        (TreeSitterArtifact, "tree-sitter-artifact.v1.json"),
        (CiLogArtifact, "ci-log-artifact.v1.json"),
        (CiFailureExplanationArtifact, "ci-failure-explanation.v1.json"),
        (LlmReviewOutput, "llm-review-output.v1.json"),
        (PublishPayload, "publish-payload.v1.json"),
        (CodebaseScanJobInput, "codebase-scan-job-input.v1.json"),
        (CodebaseScanArtifactMetadata, "codebase-scan-artifact-metadata.v1.json"),
        (CodebaseScanFinding, "codebase-scan-finding.v1.json"),
        (CodebaseScanReviewEnrichment, "codebase-scan-review-enrichment.v1.json"),
    ],
)
def test_worker_contract_models_accept_current_fixtures(model: Any, fixture_name: str) -> None:
    parsed = model.from_mapping(read_fixture(fixture_name))

    assert parsed.schema_version.endswith("/v1")


def test_worker_contract_models_reject_invalid_payloads_with_field_paths() -> None:
    payload = dict(read_fixture("llm-review-output.v1.json"))
    inline_findings = list(payload["inlineFindings"])
    first_finding = dict(inline_findings[0])
    first_finding["confidence"] = 2
    first_finding["evidence"] = []
    inline_findings[0] = first_finding
    payload["inlineFindings"] = inline_findings
    payload["schemaVersion"] = "llm-review-output/v0"

    with pytest.raises(ContractValidationError) as error:
        LlmReviewOutput.from_mapping(payload)

    assert "schemaVersion" in str(error.value)
    assert "inlineFindings[0].confidence" in str(error.value)


def test_codebase_scan_finding_rejects_secret_unsafe_shape() -> None:
    payload = dict(read_fixture("codebase-scan-finding.v1.json"))
    payload["schemaVersion"] = "codebase-scan-finding/v0"
    payload["evidence"] = []
    payload["startLine"] = 50
    payload["endLine"] = 42

    with pytest.raises(ContractValidationError) as error:
        CodebaseScanFinding.from_mapping(payload)

    assert "schemaVersion" in str(error.value)
    assert "evidence must include at least one item" in str(error.value)
    assert "endLine must be greater than or equal to startLine" in str(error.value)
