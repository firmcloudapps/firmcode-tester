from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Sequence

import pytest

from firmcode_worker.codebase_scan import (
    CodebaseScanConfig,
    CodebaseScanPipeline,
    CodebaseScanPipelineError,
    CodebaseScanWorkspacePlanner,
    CodebaseGitHubClient,
    RepositoryTreeFile,
    redact_secret_like_text,
)
from firmcode_worker.llm import FakeLLMClient
from firmcode_worker.schemas.contracts import CodebaseScanJobInput
from firmcode_worker.semgrep.runner import SemgrepProcessError


@dataclass(frozen=True)
class StubSemgrepResult:
    artifact: Mapping[str, Any]


@dataclass
class RecordingStore:
    successful_scan_exists: bool = False
    enabled: bool = True
    running: list[Mapping[str, Any]] = field(default_factory=list)
    succeeded: list[Mapping[str, Any]] = field(default_factory=list)
    failed: list[Mapping[str, Any]] = field(default_factory=list)
    superseded: list[Mapping[str, Any]] = field(default_factory=list)
    findings: list[Mapping[str, Any]] = field(default_factory=list)
    stale_resolution_calls: list[Sequence[str]] = field(default_factory=list)

    async def assert_repository_enabled(self, payload: CodebaseScanJobInput) -> None:
        if not self.enabled:
            raise CodebaseScanPipelineError("repository_not_enabled", "Repository is disabled password=super-secret")

    async def has_successful_scan(self, *, repository_id: str, commit_sha: str, scan_run_id: str) -> bool:
        assert repository_id == "repo-1"
        assert commit_sha == "commit-1"
        assert scan_run_id == "scan-1"
        return self.successful_scan_exists

    async def mark_running(self, **kwargs: Any) -> None:
        self.running.append(kwargs)

    async def mark_succeeded(self, **kwargs: Any) -> None:
        self.succeeded.append(kwargs)

    async def mark_failed(self, **kwargs: Any) -> None:
        self.failed.append(kwargs)

    async def mark_superseded(self, **kwargs: Any) -> None:
        self.superseded.append(kwargs)

    async def upsert_finding(self, *, repository_id: str, finding: Mapping[str, Any]) -> None:
        assert repository_id == "repo-1"
        self.findings.append(finding)

    async def resolve_stale_findings(self, *, scan_run_id: str, repository_id: str, observed_dedupe_keys: Sequence[str]) -> int:
        assert scan_run_id == "scan-1"
        assert repository_id == "repo-1"
        self.stale_resolution_calls.append(observed_dedupe_keys)
        return 2


class FakeCodebaseGitHub:
    def __init__(self) -> None:
        self.branch_calls = 0
        self.tree_error: Exception | None = None

    def fetch_default_branch_sha(self, *, installation_id: int, repository_full_name: str, default_branch: str) -> tuple[str, str]:
        assert installation_id == 101
        assert repository_full_name == "acme/widgets"
        assert default_branch == "main"
        self.branch_calls += 1
        return "main", "commit-1"

    def fetch_repository_tree(self, *, installation_id: int, repository_full_name: str, commit_sha: str) -> tuple[RepositoryTreeFile, ...]:
        if self.tree_error is not None:
            raise self.tree_error
        return (
            RepositoryTreeFile(path="src/app.py", sha="blob-app", size_bytes=64),
            RepositoryTreeFile(path="src/generated-client.generated.py", sha="blob-generated", size_bytes=32),
            RepositoryTreeFile(path="public/logo.png", sha="blob-binary", size_bytes=128),
        )

    def fetch_blob_content(self, *, installation_id: int, repository_full_name: str, blob_sha: str) -> tuple[str, int]:
        if blob_sha == "blob-app":
            content = "def handler(request):\n    password='super-secret'\n    return eval(request)\n"
            return content, len(content.encode("utf-8"))
        raise AssertionError(f"unexpected blob fetch: {blob_sha}")


def test_workspace_planner_applies_allowlist_ignored_generated_binary_and_budget_rules() -> None:
    planner = CodebaseScanWorkspacePlanner(
        config=CodebaseScanConfig(
            max_files=1,
            max_total_bytes=90,
            max_file_bytes=80,
            ignored_paths=("docs/*",),
            repository_allowlist=("acme/*",),
        )
    )
    planner.assert_repository_allowed("acme/widgets")

    selection = planner.plan(
        tree_files=(
            RepositoryTreeFile("docs/readme.md", "doc", 10),
            RepositoryTreeFile("src/app.py", "app", 40),
            RepositoryTreeFile("src/second.py", "second", 40),
            RepositoryTreeFile("src/huge.py", "huge", 100),
            RepositoryTreeFile("src/client.generated.ts", "generated", 12),
            RepositoryTreeFile("assets/logo.png", "binary", 12),
            RepositoryTreeFile("README.md", "readme", 5),
        ),
        fetch_content=lambda item: ("print('ok')\n", item.size_bytes or 0),
    )

    assert [file.path for file in selection.files] == ["src/app.py"]
    assert {item.path: item.reason for item in selection.skipped_paths} == {
        "README.md": "unsupported",
        "assets/logo.png": "binary",
        "docs/readme.md": "ignored",
        "src/client.generated.ts": "generated",
        "src/huge.py": "oversized",
        "src/second.py": "max_files",
    }

    with pytest.raises(CodebaseScanPipelineError):
        planner.assert_repository_allowed("other/widgets")


def test_pipeline_skips_same_successful_commit_without_resolving_stale_findings(tmp_path: Path) -> None:
    store = RecordingStore(successful_scan_exists=True)
    github = FakeCodebaseGitHub()
    pipeline = _pipeline(store=store, github=github, tmp_path=tmp_path)

    result = asyncio.run(pipeline.run(_payload()))

    assert result.status == "superseded"
    assert store.superseded[0]["commit_sha"] == "commit-1"
    assert store.running == []
    assert store.findings == []
    assert store.stale_resolution_calls == []


def test_pipeline_persists_redacted_findings_artifacts_metrics_and_resolves_stale_findings(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    store = RecordingStore()
    github = FakeCodebaseGitHub()
    llm = FakeLLMClient(
        [
            {
                "findings": [
                    {
                        "dedupeKey": "semgrep:python.lang.security.audit.eval:src/app.py:3:d7017b855ccb9091",
                        "body": "Avoid dynamic evaluation of request data.",
                        "recommendation": "Parse allowlisted operations instead of using eval.",
                    }
                ]
            }
        ]
    )
    monkeypatch.setattr(
        "firmcode_worker.codebase_scan.extract_tree_sitter_artifact",
        lambda review_run_id, files: {
            "schemaVersion": "tree-sitter-artifact/v1",
            "reviewRunId": review_run_id,
            "parserVersion": "test",
            "files": [
                {
                    "path": "src/app.py",
                    "language": "python",
                    "parser": "tree-sitter-python",
                    "parseStatus": "parsed",
                    "hasError": False,
                    "missingNodeCount": 0,
                    "errorNodeCount": 0,
                    "symbols": [
                        {
                            "name": "handler",
                            "kind": "function",
                            "range": {"startLine": 1, "endLine": 3},
                            "byteRange": {"startByte": 0, "endByte": 68},
                            "changed": False,
                        }
                    ],
                    "imports": [],
                    "hunkScopes": [],
                    "errors": [],
                }
            ],
        },
    )
    pipeline = _pipeline(store=store, github=github, tmp_path=tmp_path, llm_client=llm, llm_enabled=True)

    result = asyncio.run(pipeline.run(_payload()))

    assert result.status == "succeeded"
    assert store.running[0]["commit_sha"] == "commit-1"
    assert len(store.findings) == 1
    finding = store.findings[0]
    assert finding["severity"] == "high"
    assert finding["category"] == "security"
    assert finding["body"] == "Avoid dynamic evaluation of request data."
    assert finding["recommendation"] == "Parse allowlisted operations instead of using eval."
    assert finding["evidence"][0]["excerpt"] == SECRET_REDACTED_LINE
    assert finding["evidence"][0]["redacted"] is True
    assert finding["evidence"][0]["symbol"]["name"] == "handler"
    assert store.stale_resolution_calls == [(finding["dedupeKey"],)]
    assert store.succeeded[-1]["metrics"]["resolvedStaleFindingCount"] == 2
    assert store.succeeded[-1]["metrics"]["workspace"]["skipReasons"] == {"binary": 1, "generated": 1}
    artifact_types = {artifact["artifactType"] for artifact in store.succeeded[-1]["artifacts"]}
    assert artifact_types == {"semgrep", "tree_sitter", "scan_summary"}
    assert all(Path(artifact["storageKey"]).exists() for artifact in store.succeeded[-1]["artifacts"])


def test_pipeline_failure_persists_safe_redacted_error(tmp_path: Path) -> None:
    store = RecordingStore()
    github = FakeCodebaseGitHub()
    github.tree_error = CodebaseScanPipelineError("github_request_failed", "token ghp_1234567890abcdefghijklmnop password=super-secret")
    pipeline = _pipeline(store=store, github=github, tmp_path=tmp_path)

    with pytest.raises(CodebaseScanPipelineError):
        asyncio.run(pipeline.run(_payload()))

    assert store.failed
    assert store.failed[0]["error"]["code"] == "github_request_failed"
    assert "ghp_" not in store.failed[0]["error"]["message"]
    assert "super-secret" not in store.failed[0]["error"]["message"]
    assert "[REDACTED_SECRET]" in store.failed[0]["error"]["message"]


def test_semgrep_process_error_fails_scan_with_structured_error(tmp_path: Path) -> None:
    store = RecordingStore()
    github = FakeCodebaseGitHub()
    pipeline = CodebaseScanPipeline(
        store=store,  # type: ignore[arg-type]
        github=github,  # type: ignore[arg-type]
        config=CodebaseScanConfig(artifact_dir=tmp_path),
        semgrep_runner=lambda **_kwargs: (_ for _ in ()).throw(SemgrepProcessError("semgrep exploded password=super-secret")),
    )

    with pytest.raises(CodebaseScanPipelineError):
        asyncio.run(pipeline.run(_payload()))

    assert store.failed[0]["error"]["code"] == "semgrep_process_error"
    assert "super-secret" not in store.failed[0]["error"]["message"]


def test_tree_sitter_failure_is_recorded_without_failing_scan(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    store = RecordingStore()
    github = FakeCodebaseGitHub()
    monkeypatch.setattr(
        "firmcode_worker.codebase_scan.extract_tree_sitter_artifact",
        lambda review_run_id, files: (_ for _ in ()).throw(RuntimeError("parser failed password=super-secret")),
    )
    pipeline = _pipeline(store=store, github=github, tmp_path=tmp_path)

    result = asyncio.run(pipeline.run(_payload()))

    assert result.status == "succeeded"
    tree_sitter_artifact = next(artifact for artifact in store.succeeded[-1]["artifacts"] if artifact["artifactType"] == "tree_sitter")
    content = Path(tree_sitter_artifact["storageKey"]).read_text()
    assert "tree_sitter_failed" in content
    assert "super-secret" not in content


def test_redaction_handles_common_secret_shapes() -> None:
    redacted = redact_secret_like_text(
        "Authorization: Bearer abc.def.ghi\n"
        "AWS=AKIA1234567890ABCDEF\n"
        "github_token=github_pat_1234567890abcdefghijklmnopqrstuv\n"
        "password='super-secret'"
    )

    assert "abc.def.ghi" not in redacted
    assert "AKIA1234567890ABCDEF" not in redacted
    assert "github_pat_" not in redacted
    assert "super-secret" not in redacted


def _pipeline(
    *,
    store: RecordingStore,
    github: FakeCodebaseGitHub,
    tmp_path: Path,
    llm_client: FakeLLMClient | None = None,
    llm_enabled: bool = False,
) -> CodebaseScanPipeline:
    return CodebaseScanPipeline(
        store=store,  # type: ignore[arg-type]
        github=github,  # type: ignore[arg-type]
        config=CodebaseScanConfig(
            artifact_dir=tmp_path,
            llm_enabled=llm_enabled,
            llm_model="test-model",
        ),
        semgrep_runner=_stub_semgrep_runner,
        llm_client=llm_client,
    )


def _stub_semgrep_runner(**kwargs: Any) -> StubSemgrepResult:
    assert kwargs["review_run_id"] == "scan-1"
    assert kwargs["targets"] == ("src/app.py",)
    return StubSemgrepResult(
        artifact={
            "schemaVersion": "semgrep-artifact/v1",
            "reviewRunId": "scan-1",
            "toolVersion": "1.99.0",
            "exitCode": 1,
            "durationMs": 10,
            "findings": [
                {
                    "id": "semgrep:python.lang.security.audit.eval:src/app.py:3",
                    "ruleId": "python.lang.security.audit.eval",
                    "path": "src/app.py",
                    "start": {"line": 3, "column": 12, "offset": 48},
                    "end": {"line": 3, "column": 25, "offset": 61},
                    "severity": "high",
                    "sourceSeverity": "ERROR",
                    "message": "Use of eval with request data.",
                    "fingerprint": "fingerprint-1",
                    "lines": "password='super-secret'",
                    "metadata": {"category": "security", "cwe": "CWE-95"},
                    "fix": None,
                }
            ],
            "errors": [],
            "paths": {"scanned": ["src/app.py"], "skipped": []},
        }
    )


def _payload() -> CodebaseScanJobInput:
    return CodebaseScanJobInput(
        schema_version="codebase-scan-job-input/v1",
        scan_run_id="scan-1",
        repository_id="repo-1",
        installation_id=101,
        repository_full_name="acme/widgets",
        default_branch="main",
        commit_sha=None,
        trigger="scheduled",
        correlation_id="correlation-1",
        requested_by_user_id=None,
    )


SECRET_REDACTED_LINE = "[REDACTED_SECRET]"
