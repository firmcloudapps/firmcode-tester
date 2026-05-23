from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from firmcode_worker.schemas.contracts import SemgrepArtifact
from firmcode_worker.semgrep.normalizer import (
    normalize_semgrep_output,
    normalize_semgrep_process_failure,
)
from firmcode_worker.semgrep.runner import LOCAL_INFRA_SEMGREP_CONFIG, SemgrepScanConfig, _build_command, run_semgrep_scan


FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "semgrep"


def test_semgrep_json_normalization_maps_results_errors_and_paths() -> None:
    artifact = normalize_semgrep_output(
        review_run_id="run-1",
        exit_code=1,
        duration_ms=45,
        stderr="",
        semgrep_json={
            "version": "1.99.0",
            "results": [
                {
                    "check_id": "python.lang.security.audit.eval",
                    "path": "app.py",
                    "start": {"line": 2, "col": 12, "offset": 33},
                    "end": {"line": 2, "col": 28, "offset": 49},
                    "extra": {
                        "message": "Avoid eval.",
                        "metadata": {"category": "security"},
                        "severity": "ERROR",
                        "fingerprint": "fingerprint-1",
                        "lines": "return eval(user_input)",
                        "fix": None,
                    },
                }
            ],
            "errors": [
                {
                    "code": 2,
                    "level": "warn",
                    "type": "Syntax error",
                    "message": "Could not parse file.",
                    "path": "broken.py",
                }
            ],
            "paths": {
                "scanned": ["app.py"],
                "skipped": [
                    {"path": "dist/app.min.js", "reason": "minified", "details": "Minified file"}
                ],
            },
        },
    )

    parsed = SemgrepArtifact.from_mapping(artifact)

    assert parsed.review_run_id == "run-1"
    assert parsed.tool_version == "1.99.0"
    assert parsed.exit_code == 1
    assert parsed.findings[0].rule_id == "python.lang.security.audit.eval"
    assert parsed.findings[0].severity == "high"
    assert parsed.findings[0].source_severity == "ERROR"
    assert parsed.findings[0].start.line == 2
    assert parsed.findings[0].start.column == 12
    assert parsed.findings[0].fingerprint == "fingerprint-1"
    assert parsed.errors[0].severity == "warning"
    assert parsed.skipped_paths[0].reason == "minified"


def test_semgrep_json_normalization_records_unexpected_exit_code() -> None:
    artifact = normalize_semgrep_output(
        review_run_id="run-1",
        exit_code=2,
        duration_ms=45,
        stderr="fatal: config could not be loaded",
        semgrep_json={
            "version": "1.99.0",
            "results": [],
            "errors": [],
            "paths": {"scanned": ["app.py"], "skipped": []},
        },
    )

    parsed = SemgrepArtifact.from_mapping(artifact)

    assert parsed.exit_code == 2
    assert parsed.errors[0].code == "process_exit"
    assert "fatal: config could not be loaded" in parsed.errors[0].message
    assert parsed.scanned_paths == ["app.py"]


def test_semgrep_normalization_records_non_finding_process_failures() -> None:
    artifact = normalize_semgrep_process_failure(
        review_run_id="run-1",
        exit_code=2,
        duration_ms=10,
        code="invalid_json",
        message="Semgrep did not produce valid JSON.",
        stderr="fatal: bad config",
    )

    parsed = SemgrepArtifact.from_mapping(artifact)

    assert parsed.findings == []
    assert parsed.errors[0].code == "invalid_json"
    assert parsed.errors[0].severity == "error"
    assert "fatal: bad config" in parsed.errors[0].message


def test_semgrep_scan_config_reads_env_overrides() -> None:
    config = SemgrepScanConfig.from_env(
        {
            "SEMGREP_CONFIGS": "rules.yml,infra/semgrep/config.yml",
            "SEMGREP_TIMEOUT_MS": "12345",
            "SEMGREP_EXECUTABLE": "/usr/local/bin/semgrep",
        }
    )

    assert config.configs == ("rules.yml", "infra/semgrep/config.yml")
    assert config.timeout_ms == 12345
    assert config.executable == "/usr/local/bin/semgrep"


def test_semgrep_scan_config_replaces_auto_with_local_rules() -> None:
    assert SemgrepScanConfig.from_env({"SEMGREP_CONFIGS": "auto"}).configs == (LOCAL_INFRA_SEMGREP_CONFIG,)
    assert SemgrepScanConfig.from_env({"SEMGREP_CONFIGS": "auto,rules.yml"}).configs == (
        LOCAL_INFRA_SEMGREP_CONFIG,
        "rules.yml",
    )


def test_semgrep_default_config_uses_local_infra_rules_without_auto() -> None:
    command = _build_command(
        scan_config=SemgrepScanConfig(timeout_ms=15_000),
        targets=["src/app.py"],
    )

    assert "--config" in command
    assert "auto" not in command
    assert any(config.endswith("infra/semgrep/config.yml") for config in command)


@pytest.mark.skipif(shutil.which("semgrep") is None, reason="Semgrep CLI is not installed")
def test_semgrep_process_wrapper_scans_fixture_and_stores_raw_output(tmp_path: Path) -> None:
    result = run_semgrep_scan(
        review_run_id="run-fixture",
        cwd=FIXTURE_DIR,
        targets=["app.py"],
        artifact_dir=tmp_path,
        config=SemgrepScanConfig(configs=("rules.yml",), timeout_ms=15_000),
    )

    parsed = SemgrepArtifact.from_mapping(result.artifact)

    assert result.raw_output.exit_code in {0, 1}
    assert parsed.duration_ms >= 0
    assert parsed.findings
    assert parsed.findings[0].rule_id == "firmcode.test.dangerous-eval"
    assert parsed.findings[0].path == "app.py"
    assert result.raw_artifact is not None

    raw_artifact = json.loads(result.raw_artifact.path.read_text())
    assert raw_artifact["schemaVersion"] == "semgrep-raw-output/v1"
    assert raw_artifact["reviewRunId"] == "run-fixture"
    assert raw_artifact["stdout"]
