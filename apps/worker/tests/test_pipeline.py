from __future__ import annotations

import asyncio
import base64
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence

from firmcode_worker.pipeline import (
    ChangedFile,
    DeterministicReviewPipeline,
    GitHubFile,
    ReviewContext,
    _inline_review_body,
    _partition_existing_inline_comments,
    _render_resolution_bullets,
    _render_semgrep_fix_diff,
    normalize_private_key,
    parse_patch_hunks,
)
from firmcode_worker.schemas.contracts import ReviewJobInput


@dataclass
class RecordingStore:
    artifacts: list[tuple[str, str, Mapping[str, Any]]] = field(default_factory=list)
    changed_files: list[ChangedFile] = field(default_factory=list)
    semgrep_findings: list[Mapping[str, Any]] = field(default_factory=list)
    inline_comments: list[Any] = field(default_factory=list)
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

    async def record_inline_comments(self, review_run_id: str, comments: Sequence[Any]) -> None:
        assert review_run_id == "run-1"
        self.inline_comments.extend(comments)

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
    def __init__(self) -> None:
        self.scanning_bodies: list[str] = []
        self.inline_review_comments: list[Mapping[str, Any]] = []

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
        assert "FirmcodeAI reviewed this PR and found 1 actionable issue(s)." in body
        assert "Semgrep" not in body
        assert "Tree-sitter" not in body
        return None, True

    def publish_scanning_comment(
        self,
        *,
        installation_id: int,
        repository_full_name: str,
        pull_number: int,
        body: str,
    ) -> tuple[int | None, bool]:
        assert installation_id == 123
        assert repository_full_name == "acme/widgets"
        assert pull_number == 7
        self.scanning_bodies.append(body)
        return None, True

    def publish_inline_review_comments(
        self,
        *,
        installation_id: int,
        repository_full_name: str,
        pull_number: int,
        head_sha: str,
        review_run_id: str,
        comments: Sequence[Mapping[str, Any]],
    ) -> tuple[int | None, list[Any], bool]:
        assert installation_id == 123
        assert repository_full_name == "acme/widgets"
        assert pull_number == 7
        assert head_sha == "head123"
        assert review_run_id == "run-1"
        self.inline_review_comments.extend(comments)
        return None, [], True


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
    encoded = base64.b64encode(pem.encode("utf-8")).decode("ascii")
    unpadded = encoded.rstrip("=")
    spaced = f"{unpadded[:16]}\n {unpadded[16:40]}\n{unpadded[40:]}"

    assert normalize_private_key(f"'{escaped}'") == pem
    assert normalize_private_key(f'"{encoded}"') == pem
    assert normalize_private_key(unpadded) == pem
    assert normalize_private_key(spaced) == pem


def test_partition_existing_inline_comments_prevents_duplicate_review_posts() -> None:
    selected = [
        {
            "findingId": "finding-1",
            "path": "src/widget.ts",
            "line": 2,
            "body": "⚠️ Potential issue",
        },
        {
            "findingId": "finding-2",
            "path": "src/other.ts",
            "line": 7,
            "body": "new issue",
        },
    ]

    published, missing = _partition_existing_inline_comments(
        selected,
        [
            {
                "id": 123,
                "pull_request_review_id": 456,
                "path": "src/widget.ts",
                "line": 2,
                "body": "⚠️ Potential issue",
            }
        ],
    )

    assert len(published) == 1
    assert published[0].github_comment_id == 123
    assert published[0].github_review_id == 456
    assert published[0].finding_id == "finding-1"
    assert missing == [selected[1]]


def test_render_resolution_bullets_splits_major_points() -> None:
    lines = _render_resolution_bullets(
        "Replace the tag or branch after @ with the action commit SHA, and update it through a dependency update workflow."
    )

    assert lines == [
        "- Replace the tag or branch after @ with the action commit SHA.",
        "- Update it through a dependency update workflow.",
    ]


def test_render_semgrep_fix_diff_marks_removed_and_replacement_lines() -> None:
    diff = _render_semgrep_fix_diff(
        "const value = eval(input);",
        "const value = JSON.parse(input);",
    )

    assert diff == "- const value = eval(input);\n! const value = JSON.parse(input);"
    assert "+ const value = JSON.parse(input);" not in diff


def test_inline_review_body_omits_internal_run_ids() -> None:
    body = _inline_review_body([{"path": "src/a.ts"}, {"path": "src/b.ts"}])

    assert body == "FirmcodeAI left 2 inline code review comments on changed code."
    assert "review run" not in body


def test_deterministic_pipeline_publishes_actual_analysis_summary() -> None:
    store = RecordingStore()
    github = FakeGitHub()
    pipeline = DeterministicReviewPipeline(
        store=store,  # type: ignore[arg-type]
        github=github,  # type: ignore[arg-type]
        semgrep_runner=_stub_semgrep_runner,
        env={"SEMGREP_CONFIGS": "auto"},
    )

    asyncio.run(pipeline.run(_payload()))

    assert [file.path for file in store.changed_files] == ["src/widget.ts"]
    assert {artifact_type for artifact_type, _storage_key, _artifact in store.artifacts} == {"diff", "semgrep", "treesitter"}
    assert len(store.semgrep_findings) == 1
    assert len(github.inline_review_comments) == 1
    assert github.inline_review_comments[0]["path"] == "src/widget.ts"
    assert github.inline_review_comments[0]["line"] == 2
    inline_body = str(github.inline_review_comments[0]["body"])
    assert "⚠️ Potential issue | 🟠 Major | ⚡ Quick win" in inline_body
    assert "<summary>Analysis chain</summary>" in inline_body
    assert "- Evidence: changed line `src/widget.ts:2` contains `const value = eval(input);`." in inline_body
    assert "- Check: `typescript.eval` reported `high` severity." in inline_body
    assert "- Reference: `CWE-95`." in inline_body
    assert "```typescript" in inline_body
    assert "  const value = eval(input);" in inline_body
    assert "<summary>🛠 Suggested resolution</summary>" in inline_body
    assert "```text" not in inline_body
    assert "- Validate and parse trusted input instead of evaluating it." in inline_body
    assert "Validate and parse trusted input instead of evaluating it." in inline_body
    assert "<details open>" not in inline_body
    assert "Semgrep" not in inline_body
    assert "Tree-sitter" not in inline_body
    assert store.summary_body is not None
    assert "FirmcodeAI reviewed this PR and found 1 actionable issue(s)." in store.summary_body
    assert "### Code Review" in store.summary_body
    assert "⚠️ Potential issue | 🟠 Major | ⚡ Quick win" in store.summary_body
    assert "<summary>Analysis chain</summary>" in store.summary_body
    assert "- Evidence: changed line `src/widget.ts:2` contains `const value = eval(input);`." in store.summary_body
    assert "- Check: `typescript.eval` reported `high` severity." in store.summary_body
    assert "- Reference: `CWE-95`." in store.summary_body
    assert "```typescript" in store.summary_body
    assert "  const value = eval(input);" in store.summary_body
    assert "<summary>🛠 Suggested resolution</summary>" in store.summary_body
    assert "```text\nValidate and parse trusted input instead of evaluating it." not in store.summary_body
    assert "- Validate and parse trusted input instead of evaluating it." in store.summary_body
    assert "<summary>Risk</summary>" in store.summary_body
    assert "<summary>Changed Components</summary>" in store.summary_body
    assert "<summary>Suggested Tests</summary>" in store.summary_body
    assert "<summary>Analysis Coverage</summary>" not in store.summary_body
    assert "<summary>Review Activity</summary>" not in store.summary_body
    assert "Repository:" not in store.summary_body
    assert "Pull request:" not in store.summary_body
    assert "Trigger:" not in store.summary_body
    assert "Head SHA:" not in store.summary_body
    assert "Review run:" not in store.summary_body
    assert "Files scanned" not in store.summary_body
    assert "Inline code comments posted" not in store.summary_body
    assert "Files parsed for code context" not in store.summary_body
    assert "Avoid eval on untrusted input" in store.summary_body
    assert "`src/widget.ts:2`" in store.summary_body
    assert "<details open>" not in store.summary_body
    assert "Semgrep" not in store.summary_body
    assert "Tree-sitter" not in store.summary_body
    assert store.dry_run is True
    assert len(github.scanning_bodies) >= 4
    assert "## FirmcodeAI Analysis Progress" in github.scanning_bodies[0]
    assert "Status: `running`" in github.scanning_bodies[0]
    assert "scan new changes" not in "\n".join(github.scanning_bodies)
    assert "Status: `completed`" in github.scanning_bodies[-1]
    public_progress = "\n".join(github.scanning_bodies)
    assert "Run configuration" not in public_progress
    assert "Processing details" not in public_progress
    assert "FirmcodeAI activity" not in public_progress
    assert "Webhook accepted" not in public_progress
    assert "Review job picked up by worker" not in public_progress
    assert "Current phase" not in public_progress
    assert "Repository:" not in public_progress
    assert "Pull request:" not in public_progress
    assert "Trigger:" not in public_progress
    assert "Head SHA:" not in public_progress
    assert "Review run:" not in public_progress
    assert "Files selected for processing" not in public_progress
    assert "Skipped files" not in public_progress
    assert "Findings so far" not in public_progress
    assert "Files checked" not in public_progress
    assert "Files parsed for code context" not in public_progress
    assert "Inline code comments posted" not in public_progress
    assert "<details open>" not in "\n".join(github.scanning_bodies)
    assert "Semgrep" not in "\n".join(github.scanning_bodies)
    assert "Tree-sitter" not in "\n".join(github.scanning_bodies)


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
                    "metadata": {"cwe": ["CWE-95"], "remediation": "Validate and parse trusted input instead of evaluating it."},
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
