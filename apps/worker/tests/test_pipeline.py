from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence

from firmcode_worker.pipeline import (
    ChangedFile,
    DeterministicReviewPipeline,
    GitHubFile,
    ReviewContext,
    normalize_private_key,
    parse_patch_hunks,
)
from firmcode_worker.schemas.contracts import ReviewJobInput


@dataclass
class RecordingStore:
    artifacts: list[tuple[str, str, Mapping[str, Any]]] = field(default_factory=list)
    changed_files: list[ChangedFile] = field(default_factory=list)
    semgrep_findings: list[Mapping[str, Any]] = field(default_factory=list)
    summary_body: str | None = None
    dry_run: bool | None = None

    async def load_context(self, review_run_id: str) -> ReviewContext:
        assert review_run_id == "run-1"
        return ReviewContext(
            installation_id=123,
            repository_full_name="acme/widgets",
            repository_owner="acme",
            repository_name="widgets",
            pull_request_number=7,
            pull_request_title="Add widget parser",
            base_sha="base123",
            head_sha="head123",
        )

    async def save_changed_files(self, _review_run_id: str, files: Sequence[ChangedFile]) -> None:
        self.changed_files.extend(files)

    async def save_artifact(self, _review_run_id: str, artifact_type: str, storage_key: str, artifact: Mapping[str, Any]) -> None:
        self.artifacts.append((artifact_type, storage_key, artifact))

    async def save_semgrep_findings(self, _review_run_id: str, findings: Sequence[Mapping[str, Any]]) -> None:
        self.semgrep_findings.extend(findings)

    async def record_summary_comment(
        self,
        *,
        review_run_id: str,
        github_comment_id: int | None,
        body: str,
        dry_run: bool,
    ) -> None:
        assert review_run_id == "run-1"
        assert github_comment_id is None
        self.summary_body = body
        self.dry_run = dry_run


class FakeGitHub:
    def fetch_pull_request_files(self, *, installation_id: int, repository_full_name: str, pull_number: int) -> list[GitHubFile]:
        assert installation_id == 123
        assert repository_full_name == "acme/widgets"
        assert pull_number == 7
        return [
            GitHubFile(
                path="src/widget.ts",
                previous_path=None,
                status="modified",
                additions=2,
                deletions=0,
                patch="@@ -1,2 +1,4 @@\n export function parseWidget(input: string) {\n+  const value = eval(input);\n+  return value;\n }\n",
                size_bytes=96,
            ),
            GitHubFile(
                path="public/logo.png",
                previous_path=None,
                status="modified",
                additions=0,
                deletions=0,
                patch=None,
                size_bytes=2000,
            ),
        ]

    def fetch_file_content(self, *, installation_id: int, repository_full_name: str, path: str, ref: str) -> tuple[str, int]:
        assert path == "src/widget.ts"
        assert ref == "head123"
        return "export function parseWidget(input: string) {\n  const value = eval(input);\n  return value;\n}\n", 91

    def publish_summary_comment(
        self,
        *,
        installation_id: int,
        repository_full_name: str,
        pull_number: int,
        body: str,
    ) -> tuple[int | None, bool]:
        assert "Semgrep reported 1 finding(s)" in body
        return None, True


@dataclass(frozen=True)
class StubSemgrepResult:
    artifact: Mapping[str, Any]


def test_parse_patch_hunks_tracks_added_lines() -> None:
    hunks = parse_patch_hunks("@@ -10,2 +10,3 @@ function demo\n line\n+added\n line2\n")

    assert hunks[0]["newStart"] == 10
    assert hunks[0]["lines"][1] == {
        "type": "addition",
        "content": "added",
        "oldLineNumber": None,
        "newLineNumber": 11,
    }


def test_normalize_private_key_accepts_quoted_escaped_and_base64_pem() -> None:
    pem = "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----"
    escaped = pem.replace("\n", "\\n")
    encoded = "LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCmFiYzEyMwotLS0tLUVORCBQUklWQVRFIEtFWS0tLS0t"

    assert normalize_private_key(f"'{escaped}'") == pem
    assert normalize_private_key(f'"{encoded}"') == pem


def test_deterministic_pipeline_publishes_actual_analysis_summary() -> None:
    store = RecordingStore()
    pipeline = DeterministicReviewPipeline(
        store=store,  # type: ignore[arg-type]
        github=FakeGitHub(),  # type: ignore[arg-type]
        semgrep_runner=_stub_semgrep_runner,
        env={"SEMGREP_CONFIGS": "auto"},
    )

    asyncio.run(pipeline.run(_payload()))

    assert [file.path for file in store.changed_files] == ["src/widget.ts"]
    assert {artifact_type for artifact_type, _storage_key, _artifact in store.artifacts} == {"diff", "semgrep", "treesitter"}
    assert len(store.semgrep_findings) == 1
    assert store.summary_body is not None
    assert "FirmcodeAI analyzed 1 changed file(s)" in store.summary_body
    assert "Semgrep reported 1 finding(s)" in store.summary_body
    assert "Avoid eval on untrusted input" in store.summary_body
    assert "`src/widget.ts:2`" in store.summary_body
    assert store.dry_run is True


def _stub_semgrep_runner(**_kwargs: Any) -> StubSemgrepResult:
    return StubSemgrepResult(
        artifact={
            "schemaVersion": "semgrep-artifact/v1",
            "reviewRunId": "run-1",
            "toolVersion": "1.0.0",
            "exitCode": 1,
            "durationMs": 12,
            "findings": [
                {
                    "id": "semgrep:typescript.eval",
                    "ruleId": "typescript.eval",
                    "path": "src/widget.ts",
                    "start": {"line": 2, "column": 3, "offset": None},
                    "end": {"line": 2, "column": 21, "offset": None},
                    "severity": "high",
                    "sourceSeverity": "ERROR",
                    "message": "Avoid eval on untrusted input",
                    "fingerprint": None,
                    "lines": "const value = eval(input);",
                    "metadata": {"cwe": ["CWE-95"]},
                    "fix": None,
                }
            ],
            "errors": [],
            "paths": {"scanned": ["src/widget.ts"], "skipped": []},
        }
    )


def _payload() -> ReviewJobInput:
    return ReviewJobInput(
        schema_version="review-job-input/v1",
        delivery_id="delivery-1",
        review_run_id="run-1",
        repository_id="repo-1",
        pull_request_id="pr-1",
        pull_request_number=7,
        head_sha="head123",
        trigger_event="pull_request.opened",
    )
