from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import uuid4

from firmcode_worker.schemas.contracts import (
    DIFF_ARTIFACT_SCHEMA_VERSION,
    TREE_SITTER_ARTIFACT_SCHEMA_VERSION,
    ReviewJobInput,
)
from firmcode_worker.semgrep.runner import SemgrepProcessError, SemgrepScanConfig, run_semgrep_scan
from firmcode_worker.semgrep.workspace import ChangedFileScanInput, create_changed_file_scan_workspace
from firmcode_worker.tree_sitter.extractor import ChangedHunk, SemanticExtractionFile, extract_tree_sitter_artifact


FIRMCODEAI_SCANNING_COMMENT_MARKER = "<!-- firmcodeai:activity:scanning:v1 -->"
FIRMCODEAI_SUMMARY_COMMENT_MARKER = "<!-- firmcodeai:activity:summary:v1 -->"
FIRMCODEAI_BANNER = "\n".join(
    [
        "```text",
        "|----------------------|",
        "|      FIRMCODEAI      |",
        "|----------------------|",
        "```",
    ]
)
SUPPORTED_LANGUAGES_BY_EXTENSION = {
    ".cjs": "javascript",
    ".go": "go",
    ".hcl": "hcl",
    ".java": "java",
    ".js": "javascript",
    ".json": "json",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".py": "python",
    ".tf": "terraform",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".yaml": "yaml",
    ".yml": "yaml",
}
SUPPORTED_SPECIAL_FILENAMES = {"dockerfile": "dockerfile"}
DELETED_STATUSES = {"removed", "deleted"}
BINARY_EXTENSIONS = {
    ".7z",
    ".avif",
    ".bmp",
    ".class",
    ".dll",
    ".dmg",
    ".doc",
    ".docx",
    ".exe",
    ".gif",
    ".gz",
    ".ico",
    ".jar",
    ".jpeg",
    ".jpg",
    ".mov",
    ".mp3",
    ".mp4",
    ".pdf",
    ".png",
    ".so",
    ".tar",
    ".webp",
    ".xls",
    ".xlsx",
    ".zip",
}


class ReviewPipelineError(Exception):
    def __init__(self, error_code: str, message: str) -> None:
        super().__init__(message)
        self.error_code = error_code


@dataclass(frozen=True)
class ReviewContext:
    installation_id: int
    repository_full_name: str
    repository_owner: str
    repository_name: str
    pull_request_number: int
    pull_request_title: str
    base_sha: str
    head_sha: str


@dataclass(frozen=True)
class GitHubFile:
    path: str
    previous_path: str | None
    status: str
    additions: int
    deletions: int
    patch: str | None
    size_bytes: int | None


@dataclass(frozen=True)
class ChangedFile:
    path: str
    previous_path: str | None
    status: str
    additions: int
    deletions: int
    patch: str | None
    language: str | None
    content: str | None
    size_bytes: int | None
    changed_new_lines: tuple[int, ...]
    hunks: tuple[dict[str, Any], ...]


@dataclass(frozen=True)
class SkippedFile:
    path: str
    previous_path: str | None
    status: str
    reason: str
    detail: str
    excluded_from_semgrep: bool
    excluded_from_tree_sitter: bool
    excluded_from_llm_context: bool


@dataclass(frozen=True)
class PublishedInlineComment:
    finding_id: str
    github_review_id: int | None
    github_comment_id: int | None
    file_path: str
    line: int
    body: str
    dry_run: bool


class GitHubClient:
    def __init__(self, *, app_id: str, private_key: str, dry_run: bool = False) -> None:
        self.app_id = app_id
        self.private_key = normalize_private_key(private_key)
        self.dry_run = dry_run
        self._tokens: dict[int, str] = {}

    def fetch_pull_request_files(self, *, installation_id: int, repository_full_name: str, pull_number: int) -> list[GitHubFile]:
        token = self._installation_token(installation_id)
        owner, repo = split_repository_full_name(repository_full_name)
        files: list[GitHubFile] = []
        page = 1

        while True:
            response = self._request_json(
                "GET",
                f"/repos/{owner}/{repo}/pulls/{pull_number}/files?per_page=100&page={page}",
                token=token,
            )
            if not isinstance(response, list):
                raise ReviewPipelineError("github_response_invalid", "GitHub pull files response was not a list.")
            if not response:
                break
            files.extend(_read_github_file(item) for item in response)
            if len(response) < 100:
                break
            page += 1

        return files

    def fetch_file_content(
        self,
        *,
        installation_id: int,
        repository_full_name: str,
        path: str,
        ref: str,
    ) -> tuple[str, int | None]:
        token = self._installation_token(installation_id)
        owner, repo = split_repository_full_name(repository_full_name)
        encoded_path = "/".join(urllib.parse.quote(part) for part in path.split("/"))
        encoded_ref = urllib.parse.quote(ref, safe="")
        response = self._request_json(
            "GET",
            f"/repos/{owner}/{repo}/contents/{encoded_path}?ref={encoded_ref}",
            token=token,
        )
        if not isinstance(response, Mapping) or response.get("type") != "file":
            raise ReviewPipelineError("github_content_unavailable", f"GitHub content for {path} was not a file.")
        if response.get("encoding") != "base64" or not isinstance(response.get("content"), str):
            raise ReviewPipelineError("github_content_unavailable", f"GitHub content for {path} was not base64 text.")
        raw = base64.b64decode(response["content"].encode("ascii"), validate=False)
        return raw.decode("utf-8", errors="replace"), _read_optional_int(response.get("size"))

    def publish_summary_comment(
        self,
        *,
        installation_id: int,
        repository_full_name: str,
        pull_number: int,
        body: str,
    ) -> tuple[int | None, bool]:
        if self.dry_run:
            return None, True

        token = self._installation_token(installation_id)
        owner, repo = split_repository_full_name(repository_full_name)
        comments = self._request_json(
            "GET",
            f"/repos/{owner}/{repo}/issues/{pull_number}/comments?per_page=100",
            token=token,
        )
        if not isinstance(comments, list):
            raise ReviewPipelineError("github_response_invalid", "GitHub issue comments response was not a list.")

        existing_id: int | None = None
        for comment in comments:
            if isinstance(comment, Mapping) and isinstance(comment.get("body"), str):
                if FIRMCODEAI_SUMMARY_COMMENT_MARKER in comment["body"] and isinstance(comment.get("id"), int):
                    existing_id = comment["id"]
                    break

        if existing_id is not None:
            self._request_json("PATCH", f"/repos/{owner}/{repo}/issues/comments/{existing_id}", token=token, body={"body": body})
            return existing_id, False

        created = self._request_json("POST", f"/repos/{owner}/{repo}/issues/{pull_number}/comments", token=token, body={"body": body})
        if not isinstance(created, Mapping) or not isinstance(created.get("id"), int):
            raise ReviewPipelineError("github_response_invalid", "GitHub create comment response did not include an id.")
        return created["id"], False

    def publish_scanning_comment(
        self,
        *,
        installation_id: int,
        repository_full_name: str,
        pull_number: int,
        body: str,
    ) -> tuple[int | None, bool]:
        if self.dry_run:
            return None, True

        token = self._installation_token(installation_id)
        owner, repo = split_repository_full_name(repository_full_name)
        comments = self._request_json(
            "GET",
            f"/repos/{owner}/{repo}/issues/{pull_number}/comments?per_page=100",
            token=token,
        )
        if not isinstance(comments, list):
            raise ReviewPipelineError("github_response_invalid", "GitHub issue comments response was not a list.")

        existing_id: int | None = None
        for comment in comments:
            if isinstance(comment, Mapping) and isinstance(comment.get("body"), str):
                if FIRMCODEAI_SCANNING_COMMENT_MARKER in comment["body"] and isinstance(comment.get("id"), int):
                    existing_id = comment["id"]
                    break

        if existing_id is not None:
            self._request_json("PATCH", f"/repos/{owner}/{repo}/issues/comments/{existing_id}", token=token, body={"body": body})
            return existing_id, False

        created = self._request_json("POST", f"/repos/{owner}/{repo}/issues/{pull_number}/comments", token=token, body={"body": body})
        if not isinstance(created, Mapping) or not isinstance(created.get("id"), int):
            raise ReviewPipelineError("github_response_invalid", "GitHub create comment response did not include an id.")
        return created["id"], False

    def publish_inline_review_comments(
        self,
        *,
        installation_id: int,
        repository_full_name: str,
        pull_number: int,
        head_sha: str,
        review_run_id: str,
        comments: Sequence[Mapping[str, Any]],
    ) -> tuple[int | None, list[PublishedInlineComment], bool]:
        if not comments:
            return None, [], self.dry_run

        selected_comments = [dict(comment) for comment in comments]
        if self.dry_run:
            return (
                None,
                [
                    PublishedInlineComment(
                        finding_id=_read_str(comment.get("findingId"), ""),
                        github_review_id=None,
                        github_comment_id=None,
                        file_path=_read_str(comment.get("path"), ""),
                        line=_read_int(comment.get("line"), 1),
                        body=_read_str(comment.get("body"), ""),
                        dry_run=True,
                    )
                    for comment in selected_comments
                ],
                True,
            )

        token = self._installation_token(installation_id)
        owner, repo = split_repository_full_name(repository_full_name)
        created = self._request_json(
            "POST",
            f"/repos/{owner}/{repo}/pulls/{pull_number}/reviews",
            token=token,
            body={
                "commit_id": head_sha,
                "event": "COMMENT",
                "body": f"FirmcodeAI code scan review for review run `{review_run_id}`.",
                "comments": [
                    {
                        "path": _read_str(comment.get("path"), ""),
                        "line": _read_int(comment.get("line"), 1),
                        "side": "RIGHT",
                        "body": _read_str(comment.get("body"), ""),
                    }
                    for comment in selected_comments
                ],
            },
        )
        if not isinstance(created, Mapping) or not isinstance(created.get("id"), int):
            raise ReviewPipelineError("github_response_invalid", "GitHub create review response did not include an id.")
        review_id = created["id"]

        review_comments = self._request_json(
            "GET",
            f"/repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments?per_page=100",
            token=token,
        )
        if not isinstance(review_comments, list):
            raise ReviewPipelineError("github_response_invalid", "GitHub review comments response was not a list.")

        return review_id, _match_published_inline_comments(review_id, selected_comments, review_comments), False

    def _installation_token(self, installation_id: int) -> str:
        cached = self._tokens.get(installation_id)
        if cached is not None:
            return cached
        jwt_token = create_github_app_jwt(app_id=self.app_id, private_key=self.private_key)
        response = self._request_json("POST", f"/app/installations/{installation_id}/access_tokens", jwt_token=jwt_token)
        if not isinstance(response, Mapping) or not isinstance(response.get("token"), str):
            raise ReviewPipelineError("github_token_unavailable", "GitHub installation token response did not include a token.")
        token = response["token"]
        self._tokens[installation_id] = token
        return token

    def _request_json(
        self,
        method: str,
        path: str,
        *,
        token: str | None = None,
        jwt_token: str | None = None,
        body: Mapping[str, Any] | None = None,
    ) -> Any:
        payload = None if body is None else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            f"https://api.github.com{path}",
            data=payload,
            method=method,
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {token or jwt_token or ''}",
                "Content-Type": "application/json",
                "User-Agent": "firmcodeai",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                if response.status == 204:
                    return None
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")[:500]
            raise ReviewPipelineError("github_request_failed", f"GitHub request {method} {path} failed: {error.code} {detail}") from error
        except OSError as error:
            raise ReviewPipelineError("github_request_failed", f"GitHub request {method} {path} failed: {error}") from error


class PostgresReviewPipelineStore:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    async def load_context(self, review_run_id: str) -> ReviewContext:
        import psycopg

        async with await psycopg.AsyncConnection.connect(self.database_url) as connection:
            async with connection.cursor(row_factory=psycopg.rows.dict_row) as cursor:
                await cursor.execute(
                    """
SELECT
  gi.installation_id,
  r.full_name AS repository_full_name,
  r.owner AS repository_owner,
  r.name AS repository_name,
  pr.number AS pull_request_number,
  pr.title AS pull_request_title,
  pr.base_sha,
  pr.head_sha
FROM review_runs rr
JOIN repositories r ON r.id = rr.repository_id
JOIN github_installations gi ON gi.id = r.installation_id
JOIN pull_requests pr ON pr.id = rr.pull_request_id
WHERE rr.id = %s
""",
                    (review_run_id,),
                )
                row = await cursor.fetchone()

        if row is None:
            raise ReviewPipelineError("review_context_not_found", f"Review run {review_run_id} was not found.")

        return ReviewContext(
            installation_id=int(row["installation_id"]),
            repository_full_name=str(row["repository_full_name"]),
            repository_owner=str(row["repository_owner"]),
            repository_name=str(row["repository_name"]),
            pull_request_number=int(row["pull_request_number"]),
            pull_request_title=str(row["pull_request_title"]),
            base_sha=str(row["base_sha"]),
            head_sha=str(row["head_sha"]),
        )

    async def save_changed_files(self, review_run_id: str, files: Sequence[ChangedFile]) -> None:
        import psycopg

        async with await psycopg.AsyncConnection.connect(self.database_url) as connection:
            async with connection.cursor() as cursor:
                for file in files:
                    await cursor.execute(
                        """
INSERT INTO changed_files (
  id,
  review_run_id,
  path,
  status,
  additions,
  deletions,
  patch,
  language,
  is_infrastructure,
  is_supported,
  risk_flags_json
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
ON CONFLICT (review_run_id, path) DO UPDATE
SET status = EXCLUDED.status,
    additions = EXCLUDED.additions,
    deletions = EXCLUDED.deletions,
    patch = EXCLUDED.patch,
    language = EXCLUDED.language,
    is_infrastructure = EXCLUDED.is_infrastructure,
    is_supported = EXCLUDED.is_supported,
    risk_flags_json = EXCLUDED.risk_flags_json
""",
                        (
                            str(uuid4()),
                            review_run_id,
                            file.path,
                            file.status,
                            file.additions,
                            file.deletions,
                            file.patch,
                            file.language,
                            _is_infrastructure_path(file.path),
                            file.language is not None,
                            json.dumps([]),
                        ),
                    )

    async def save_artifact(self, review_run_id: str, artifact_type: str, storage_key: str, artifact: Mapping[str, Any]) -> None:
        import psycopg

        async with await psycopg.AsyncConnection.connect(self.database_url) as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    """
INSERT INTO analysis_artifacts (
  id,
  review_run_id,
  artifact_type,
  storage_key,
  metadata_json
) VALUES (%s, %s, %s, %s, %s::jsonb)
ON CONFLICT (review_run_id, artifact_type, storage_key) DO UPDATE
SET metadata_json = EXCLUDED.metadata_json
""",
                    (str(uuid4()), review_run_id, artifact_type, storage_key, json.dumps({"artifact": artifact})),
                )

    async def save_semgrep_findings(self, review_run_id: str, findings: Sequence[Mapping[str, Any]]) -> None:
        import psycopg

        async with await psycopg.AsyncConnection.connect(self.database_url) as connection:
            async with connection.cursor() as cursor:
                for finding in findings:
                    start = _read_object(finding.get("start"))
                    end = _read_object(finding.get("end"))
                    await cursor.execute(
                        """
INSERT INTO findings (
  id,
  review_run_id,
  source,
  category,
  severity,
  confidence,
  file_path,
  start_line,
  end_line,
  title,
  body,
  evidence_json,
  suggestion,
  dedupe_key,
  post_as_inline
) VALUES (%s, %s, 'semgrep', %s, %s, 'high', %s, %s, %s, %s, %s, %s::jsonb, %s, %s, true)
ON CONFLICT (review_run_id, dedupe_key) DO UPDATE
SET severity = EXCLUDED.severity,
    body = EXCLUDED.body,
    evidence_json = EXCLUDED.evidence_json,
    suggestion = EXCLUDED.suggestion
""",
                        (
                            str(uuid4()),
                            review_run_id,
                            _semgrep_category(finding),
                            _read_str(finding.get("severity"), "info"),
                            _read_str(finding.get("path"), ""),
                            _read_optional_positive_int(start.get("line")),
                            _read_optional_positive_int(end.get("line")),
                            _read_str(finding.get("ruleId"), "Semgrep finding"),
                            _read_str(finding.get("message"), "Semgrep finding"),
                            json.dumps([_semgrep_evidence(finding)]),
                            _read_optional_str(finding.get("fix")),
                            _read_str(finding.get("id"), _dedupe_hash(finding)),
                        ),
                    )

    async def record_summary_comment(
        self,
        *,
        review_run_id: str,
        github_comment_id: int | None,
        body: str,
        dry_run: bool,
    ) -> None:
        import psycopg

        async with await psycopg.AsyncConnection.connect(self.database_url) as connection:
            async with connection.cursor() as cursor:
                if github_comment_id is not None:
                    await cursor.execute(
                        """
INSERT INTO published_comments (
  id,
  review_run_id,
  github_comment_id,
  comment_type,
  body,
  body_hash,
  dry_run
) VALUES (%s, %s, %s, 'summary', %s, %s, %s)
ON CONFLICT (github_comment_id) WHERE github_comment_id IS NOT NULL DO UPDATE
SET review_run_id = EXCLUDED.review_run_id,
    comment_type = EXCLUDED.comment_type,
    body = EXCLUDED.body,
    body_hash = EXCLUDED.body_hash,
    dry_run = EXCLUDED.dry_run
""",
                        (str(uuid4()), review_run_id, github_comment_id, body, _body_hash(review_run_id, body), dry_run),
                    )
                    return

                await cursor.execute(
                    """
INSERT INTO published_comments (
  id,
  review_run_id,
  github_comment_id,
  comment_type,
  body,
  body_hash,
  dry_run
) VALUES (%s, %s, %s, 'summary', %s, %s, %s)
ON CONFLICT (review_run_id, comment_type, body_hash) DO UPDATE
SET github_comment_id = EXCLUDED.github_comment_id,
    body = EXCLUDED.body,
    dry_run = EXCLUDED.dry_run
""",
                    (str(uuid4()), review_run_id, github_comment_id, body, _body_hash(review_run_id, body), dry_run),
                )

    async def record_inline_comments(self, review_run_id: str, comments: Sequence[PublishedInlineComment]) -> None:
        if not comments:
            return

        import psycopg

        async with await psycopg.AsyncConnection.connect(self.database_url) as connection:
            async with connection.cursor() as cursor:
                for comment in comments:
                    await cursor.execute(
                        """
INSERT INTO published_comments (
  id,
  review_run_id,
  github_review_id,
  github_comment_id,
  comment_type,
  file_path,
  line,
  body,
  body_hash,
  dry_run
) VALUES (%s, %s, %s, %s, 'inline', %s, %s, %s, %s, %s)
ON CONFLICT (review_run_id, comment_type, body_hash) DO UPDATE
SET github_review_id = EXCLUDED.github_review_id,
    github_comment_id = EXCLUDED.github_comment_id,
    file_path = EXCLUDED.file_path,
    line = EXCLUDED.line,
    body = EXCLUDED.body,
    dry_run = EXCLUDED.dry_run
""",
                        (
                            str(uuid4()),
                            review_run_id,
                            comment.github_review_id,
                            comment.github_comment_id,
                            comment.file_path,
                            comment.line,
                            comment.body,
                            _body_hash(review_run_id, f"{comment.finding_id}\0{comment.file_path}\0{comment.line}\0{comment.body}"),
                            comment.dry_run,
                        ),
                    )


class DeterministicReviewPipeline:
    def __init__(
        self,
        *,
        store: PostgresReviewPipelineStore,
        github: GitHubClient,
        semgrep_runner: Callable[..., Any] = run_semgrep_scan,
        env: Mapping[str, str] = os.environ,
    ) -> None:
        self.store = store
        self.github = github
        self.semgrep_runner = semgrep_runner
        self.env = env

    @classmethod
    def from_env(cls, *, database_url: str, env: Mapping[str, str] = os.environ) -> "DeterministicReviewPipeline":
        return cls(
            store=PostgresReviewPipelineStore(database_url),
            github=GitHubClient(
                app_id=_read_required_env(env, "GITHUB_APP_ID"),
                private_key=_read_required_env(env, "GITHUB_APP_PRIVATE_KEY"),
                dry_run=_read_bool(env.get("DRY_RUN"), default=False),
            ),
            env=env,
        )

    async def run(self, payload: ReviewJobInput) -> None:
        context = await self.store.load_context(payload.review_run_id)
        changed_files: list[ChangedFile] = []
        skipped_files: list[SkippedFile] = []

        try:
            self._publish_progress(context=context, payload=payload, status="running", phase="Fetching pull request changes")
            github_files = self.github.fetch_pull_request_files(
                installation_id=context.installation_id,
                repository_full_name=context.repository_full_name,
                pull_number=context.pull_request_number,
            )
            changed_files, skipped_files = self._prepare_changed_files(context, github_files)
            self._publish_progress(
                context=context,
                payload=payload,
                status="running",
                phase="Changed files selected for deterministic analysis",
                selected_file_count=len(changed_files),
                skipped_file_count=len(skipped_files),
            )
            diff_artifact = _build_diff_artifact(context, payload.review_run_id, changed_files, skipped_files)

            await self.store.save_changed_files(payload.review_run_id, changed_files)
            await self.store.save_artifact(payload.review_run_id, "diff", "diff-artifact/v1", diff_artifact)

            self._publish_progress(
                context=context,
                payload=payload,
                status="running",
                phase="Running Semgrep on selected changed files",
                selected_file_count=len(changed_files),
                skipped_file_count=len(skipped_files),
            )
            semgrep_artifact = self._run_semgrep(payload.review_run_id, changed_files, skipped_files)
            await self.store.save_artifact(payload.review_run_id, "semgrep", "semgrep-artifact/v1", semgrep_artifact)
            await self.store.save_semgrep_findings(payload.review_run_id, _read_list(semgrep_artifact.get("findings")))

            self._publish_progress(
                context=context,
                payload=payload,
                status="running",
                phase="Extracting Tree-sitter semantic facts",
                selected_file_count=len(changed_files),
                skipped_file_count=len(skipped_files),
                semgrep_finding_count=len(_read_list(semgrep_artifact.get("findings"))),
            )
            tree_sitter_artifact = _run_tree_sitter(payload.review_run_id, changed_files)
            await self.store.save_artifact(payload.review_run_id, "treesitter", "tree-sitter-artifact/v1", tree_sitter_artifact)

            inline_comments = _build_semgrep_inline_review_comments(
                semgrep_artifact=semgrep_artifact,
                changed_files=changed_files,
                max_comments=_read_positive_int(self.env.get("REVIEW_MAX_INLINE_COMMENTS"), 10),
            )
            inline_comment_count = 0
            if inline_comments:
                self._publish_progress(
                    context=context,
                    payload=payload,
                    status="running",
                    phase="Publishing inline code scan comments",
                    selected_file_count=len(changed_files),
                    skipped_file_count=len(skipped_files),
                    semgrep_finding_count=len(_read_list(semgrep_artifact.get("findings"))),
                    semgrep_scanned_count=len(_semgrep_scanned_paths(semgrep_artifact)),
                    semgrep_error_count=len(_read_list(semgrep_artifact.get("errors"))),
                    tree_sitter_parsed_count=_tree_sitter_parsed_count(tree_sitter_artifact),
                )
                _review_id, published_inline_comments, _inline_dry_run = self.github.publish_inline_review_comments(
                    installation_id=context.installation_id,
                    repository_full_name=context.repository_full_name,
                    pull_number=context.pull_request_number,
                    head_sha=context.head_sha,
                    review_run_id=payload.review_run_id,
                    comments=inline_comments,
                )
                await self.store.record_inline_comments(payload.review_run_id, published_inline_comments)
                inline_comment_count = len(published_inline_comments)

            summary = render_summary_comment(
                context=context,
                payload=payload,
                changed_files=changed_files,
                skipped_files=skipped_files,
                semgrep_artifact=semgrep_artifact,
                tree_sitter_artifact=tree_sitter_artifact,
                inline_comment_count=inline_comment_count,
            )
            github_comment_id, dry_run = self.github.publish_summary_comment(
                installation_id=context.installation_id,
                repository_full_name=context.repository_full_name,
                pull_number=context.pull_request_number,
                body=summary,
            )
            await self.store.record_summary_comment(
                review_run_id=payload.review_run_id,
                github_comment_id=github_comment_id,
                body=summary,
                dry_run=dry_run,
            )
            self._publish_progress(
                context=context,
                payload=payload,
                status="completed",
                phase="Analysis complete; summary comment published",
                selected_file_count=len(changed_files),
                skipped_file_count=len(skipped_files),
                semgrep_finding_count=len(_read_list(semgrep_artifact.get("findings"))),
                semgrep_scanned_count=len(_semgrep_scanned_paths(semgrep_artifact)),
                semgrep_error_count=len(_read_list(semgrep_artifact.get("errors"))),
                tree_sitter_parsed_count=_tree_sitter_parsed_count(tree_sitter_artifact),
                inline_comment_count=inline_comment_count,
            )

            _log(
                "review.pipeline.completed",
                reviewRunId=payload.review_run_id,
                repositoryFullName=context.repository_full_name,
                pullRequestNumber=context.pull_request_number,
                changedFileCount=len(changed_files),
                skippedFileCount=len(skipped_files),
                semgrepFindingCount=len(_read_list(semgrep_artifact.get("findings"))),
                inlineCommentCount=inline_comment_count,
                dryRun=dry_run,
            )
        except Exception as error:
            self._publish_progress(
                context=context,
                payload=payload,
                status="failed",
                phase="Analysis failed before completion",
                selected_file_count=len(changed_files) if changed_files else None,
                skipped_file_count=len(skipped_files) if skipped_files else None,
                error_message=str(error),
            )
            raise

    def _prepare_changed_files(
        self,
        context: ReviewContext,
        github_files: Sequence[GitHubFile],
    ) -> tuple[list[ChangedFile], list[SkippedFile]]:
        changed_files: list[ChangedFile] = []
        skipped_files: list[SkippedFile] = []
        max_files = _read_positive_int(self.env.get("REVIEW_MAX_FILES"), 50)
        max_content_bytes = _read_positive_int(self.env.get("TREESITTER_MAX_FILE_BYTES"), 500_000)

        for github_file in github_files[:max_files]:
            normalized_status = _normalize_file_status(github_file.status)
            language = _language_for_path(github_file.path)
            hunk_data = parse_patch_hunks(github_file.patch or "")
            changed_new_lines = tuple(
                line["newLineNumber"]
                for hunk in hunk_data
                for line in hunk["lines"]
                if line["type"] == "addition" and isinstance(line["newLineNumber"], int)
            )

            if normalized_status in {"deleted", "removed"}:
                skipped_files.append(_skipped(github_file, normalized_status, "deleted", "Deleted files do not have head content."))
                continue
            if Path(github_file.path).suffix.lower() in BINARY_EXTENSIONS:
                skipped_files.append(_skipped(github_file, normalized_status, "binary", "Binary files are not scanned."))
                continue
            if language is None:
                skipped_files.append(_skipped(github_file, normalized_status, "unsupported", "File extension is not enabled yet."))
                continue

            try:
                content, size_bytes = self.github.fetch_file_content(
                    installation_id=context.installation_id,
                    repository_full_name=context.repository_full_name,
                    path=github_file.path,
                    ref=context.head_sha,
                )
            except ReviewPipelineError as error:
                skipped_files.append(_skipped(github_file, normalized_status, "content_unavailable", str(error)))
                continue

            if size_bytes is not None and size_bytes > max_content_bytes:
                skipped_files.append(_skipped(github_file, normalized_status, "oversized", "File exceeds configured worker content limit."))
                continue

            changed_files.append(
                ChangedFile(
                    path=github_file.path,
                    previous_path=github_file.previous_path,
                    status=normalized_status,
                    additions=github_file.additions,
                    deletions=github_file.deletions,
                    patch=github_file.patch,
                    language=language,
                    content=content,
                    size_bytes=size_bytes,
                    changed_new_lines=changed_new_lines,
                    hunks=tuple(hunk_data),
                )
            )

        for github_file in github_files[max_files:]:
            skipped_files.append(
                _skipped(
                    github_file,
                    _normalize_file_status(github_file.status),
                    "max_files",
                    f"Review is capped at {max_files} changed files.",
                )
            )

        return changed_files, skipped_files

    def _run_semgrep(
        self,
        review_run_id: str,
        changed_files: Sequence[ChangedFile],
        skipped_files: Sequence[SkippedFile],
    ) -> dict[str, Any]:
        scan_inputs = [
            ChangedFileScanInput(path=file.path, content=file.content or "", status=file.status, language=file.language)
            for file in changed_files
            if file.content is not None
        ]
        if not scan_inputs:
            return _empty_semgrep_artifact(review_run_id, skipped_files)

        try:
            with create_changed_file_scan_workspace(changed_files=scan_inputs) as workspace:
                if not workspace.targets:
                    return _empty_semgrep_artifact(review_run_id, skipped_files)
                result = self.semgrep_runner(
                    review_run_id=review_run_id,
                    targets=workspace.targets,
                    config=SemgrepScanConfig.from_env(self.env),
                    cwd=workspace.root,
                )
                artifact = dict(result.artifact)
        except SemgrepProcessError as error:
            return _semgrep_failure_artifact(review_run_id, "semgrep_process_error", str(error))

        existing_skipped = _read_object(artifact.get("paths")).get("skipped")
        merged_skipped = _read_list(existing_skipped) + [_skipped_to_semgrep_path(file) for file in skipped_files]
        paths = dict(_read_object(artifact.get("paths")))
        paths["skipped"] = merged_skipped
        artifact["paths"] = paths
        return artifact

    def _publish_progress(
        self,
        *,
        context: ReviewContext,
        payload: ReviewJobInput,
        status: str,
        phase: str,
        selected_file_count: int | None = None,
        skipped_file_count: int | None = None,
        semgrep_finding_count: int | None = None,
        semgrep_scanned_count: int | None = None,
        semgrep_error_count: int | None = None,
        tree_sitter_parsed_count: int | None = None,
        inline_comment_count: int | None = None,
        error_message: str | None = None,
    ) -> None:
        body = render_scanning_progress_comment(
            context=context,
            payload=payload,
            status=status,
            phase=phase,
            selected_file_count=selected_file_count,
            skipped_file_count=skipped_file_count,
            semgrep_finding_count=semgrep_finding_count,
            semgrep_scanned_count=semgrep_scanned_count,
            semgrep_error_count=semgrep_error_count,
            tree_sitter_parsed_count=tree_sitter_parsed_count,
            inline_comment_count=inline_comment_count,
            error_message=error_message,
        )
        try:
            _comment_id, dry_run = self.github.publish_scanning_comment(
                installation_id=context.installation_id,
                repository_full_name=context.repository_full_name,
                pull_number=context.pull_request_number,
                body=body,
            )
            _log(
                "review.progress.published",
                reviewRunId=payload.review_run_id,
                repositoryFullName=context.repository_full_name,
                pullRequestNumber=context.pull_request_number,
                status=status,
                phase=phase,
                dryRun=dry_run,
            )
        except Exception as error:
            _log(
                "review.progress.publish_failed",
                reviewRunId=payload.review_run_id,
                repositoryFullName=context.repository_full_name,
                pullRequestNumber=context.pull_request_number,
                status=status,
                phase=phase,
                error=error.__class__.__name__,
                message=str(error)[:500],
            )


def parse_patch_hunks(patch: str) -> list[dict[str, Any]]:
    hunks: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    old_line: int | None = None
    new_line: int | None = None

    for raw_line in patch.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        match = re.match(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$", raw_line)
        if match:
            old_start = int(match.group(1))
            new_start = int(match.group(3))
            current = {
                "oldStart": old_start,
                "oldLineCount": int(match.group(2) or "1"),
                "newStart": new_start,
                "newLineCount": int(match.group(4) or "1"),
                "sectionHeader": match.group(5) or "",
                "lines": [],
            }
            old_line = old_start
            new_line = new_start
            hunks.append(current)
            continue

        if current is None or old_line is None or new_line is None:
            continue
        if raw_line.startswith("\\"):
            continue

        prefix = raw_line[:1]
        content = raw_line[1:] if prefix in {" ", "+", "-"} else raw_line
        if prefix == "+":
            current["lines"].append({"type": "addition", "content": content, "oldLineNumber": None, "newLineNumber": new_line})
            new_line += 1
        elif prefix == "-":
            current["lines"].append({"type": "deletion", "content": content, "oldLineNumber": old_line, "newLineNumber": None})
            old_line += 1
        else:
            current["lines"].append({"type": "context", "content": content, "oldLineNumber": old_line, "newLineNumber": new_line})
            old_line += 1
            new_line += 1

    return hunks


def render_summary_comment(
    *,
    context: ReviewContext,
    payload: ReviewJobInput,
    changed_files: Sequence[ChangedFile],
    skipped_files: Sequence[SkippedFile],
    semgrep_artifact: Mapping[str, Any],
    tree_sitter_artifact: Mapping[str, Any],
    inline_comment_count: int = 0,
) -> str:
    semgrep_findings = _read_list(semgrep_artifact.get("findings"))
    semgrep_errors = _read_list(semgrep_artifact.get("errors"))
    semgrep_scanned_paths = _semgrep_scanned_paths(semgrep_artifact)
    semgrep_skipped_paths = _semgrep_skipped_paths(semgrep_artifact)
    tree_files = _read_list(tree_sitter_artifact.get("files"))
    parsed_count = _tree_sitter_parsed_count(tree_sitter_artifact)
    partial_count = sum(1 for file in tree_files if _read_str(_read_object(file).get("parseStatus"), "") == "partial")
    risk_level = _risk_level(semgrep_findings, semgrep_errors)
    components = _changed_components(changed_files)
    finding_lines = [_render_semgrep_finding(finding) for finding in semgrep_findings[:8]]
    if not finding_lines:
        finding_lines = ["No Semgrep findings were reported for the selected changed files."]
    suggestions = _test_suggestions(changed_files, semgrep_findings)

    return "\n".join(
        [
            FIRMCODEAI_SUMMARY_COMMENT_MARKER,
            FIRMCODEAI_BANNER,
            "## FirmcodeAI Summary",
            "",
            (
                f"FirmcodeAI analyzed {len(changed_files)} changed file(s) in this PR and skipped "
                f"{len(skipped_files)} file(s). Semgrep reported {len(semgrep_findings)} finding(s); "
                f"Tree-sitter parsed {parsed_count} file(s)"
                + (f" with {partial_count} partial parse(s)." if partial_count else ".")
            ),
            "",
            "### Risk",
            "",
            f"- Level: {risk_level}",
            "",
            "### Changed components",
            "",
            *[f"- {component}" for component in (components or ["No supported changed files were selected."])],
            "",
            "### Code scan",
            "",
            f"- Semgrep scanned files: {len(semgrep_scanned_paths)}",
            f"- Semgrep skipped files: {len(semgrep_skipped_paths)}",
            f"- Semgrep errors: {len(semgrep_errors)}",
            f"- Inline code comments posted: {inline_comment_count}",
            f"- Tree-sitter parsed files: {parsed_count}",
            *(_render_scan_path_block("Semgrep scanned paths", semgrep_scanned_paths) if semgrep_scanned_paths else []),
            *(_render_scan_path_block("Semgrep skipped paths", _format_semgrep_skipped_paths(semgrep_skipped_paths)) if semgrep_skipped_paths else []),
            *(_render_semgrep_error_block(semgrep_errors) if semgrep_errors else []),
            "",
            "### Key findings",
            "",
            *[f"- {line}" for line in finding_lines],
            "",
            "### Suggested tests",
            "",
            *[f"- {suggestion}" for suggestion in suggestions],
            "",
            "### Review activity",
            "",
            f"- Repository: `{context.repository_full_name}`",
            f"- Pull request: #{context.pull_request_number}",
            f"- Trigger: `{payload.trigger_event}`",
            f"- Head SHA: `{context.head_sha[:12]}`",
            f"- Review run: `{payload.review_run_id}`",
            f"- Files selected: {len(changed_files)}",
            f"- Files skipped: {len(skipped_files)}",
            f"- Semgrep errors: {len(semgrep_errors)}",
            "",
            "<sub>FirmcodeAI grounds this summary in changed files, Semgrep output, and Tree-sitter parse facts.</sub>",
        ]
    )


def render_scanning_progress_comment(
    *,
    context: ReviewContext,
    payload: ReviewJobInput,
    status: str,
    phase: str,
    selected_file_count: int | None = None,
    skipped_file_count: int | None = None,
    semgrep_finding_count: int | None = None,
    semgrep_scanned_count: int | None = None,
    semgrep_error_count: int | None = None,
    tree_sitter_parsed_count: int | None = None,
    inline_comment_count: int | None = None,
    error_message: str | None = None,
) -> str:
    status_message = {
        "running": "FirmcodeAI is actively analyzing this PR.",
        "completed": "FirmcodeAI finished deterministic analysis for this PR.",
        "failed": "FirmcodeAI could not finish analysis for this PR.",
    }.get(status, "FirmcodeAI is processing this PR.")
    activity_lines = [
        "- Webhook accepted",
        "- Review job picked up by worker",
        f"- Current phase: {phase}",
        "- Changed-file workspace preserves repository-relative paths",
    ]
    if selected_file_count is not None:
        activity_lines.append(f"- Files selected for processing: {selected_file_count}")
    else:
        activity_lines.append("- Files selected for processing: pending")
    if skipped_file_count is not None:
        activity_lines.append(f"- Skipped files: {skipped_file_count}")
    else:
        activity_lines.append("- Skipped files: pending")
    if semgrep_finding_count is not None:
        activity_lines.append(f"- Semgrep findings so far: {semgrep_finding_count}")
    if semgrep_scanned_count is not None:
        activity_lines.append(f"- Semgrep scanned files: {semgrep_scanned_count}")
    if semgrep_error_count is not None:
        activity_lines.append(f"- Semgrep errors: {semgrep_error_count}")
    if tree_sitter_parsed_count is not None:
        activity_lines.append(f"- Tree-sitter parsed files: {tree_sitter_parsed_count}")
    if inline_comment_count is not None:
        activity_lines.append(f"- Inline code comments posted: {inline_comment_count}")
    if error_message:
        activity_lines.append(f"- Failure: {_single_line(error_message)[:300]}")

    return "\n".join(
        [
            FIRMCODEAI_SCANNING_COMMENT_MARKER,
            FIRMCODEAI_BANNER,
            "## FirmcodeAI Analysis Progress",
            "",
            f"> [!{'CAUTION' if status == 'failed' else 'NOTE'}]",
            f"> {status_message}",
            "",
            "### Progress",
            "",
            f"- Status: `{status}`",
            f"- Phase: `{phase}`",
            "",
            "<details>",
            "<summary>Run configuration</summary>",
            "",
            f"- Repository: `{context.repository_full_name}`",
            f"- Pull request: #{context.pull_request_number}",
            f"- Trigger: `{payload.trigger_event}`",
            f"- Head SHA: `{context.head_sha[:12]}`",
            f"- Review run: `{payload.review_run_id}`",
            "",
            "</details>",
            "",
            "<details open>",
            "<summary>FirmcodeAI activity</summary>",
            "",
            *activity_lines,
            "",
            "</details>",
            "",
            "<sub>This comment is updated by the worker as analysis progresses.</sub>",
        ]
    )


def create_github_app_jwt(*, app_id: str, private_key: str, now_seconds: int | None = None) -> str:
    import jwt

    now = now_seconds if now_seconds is not None else int(time.time())
    return jwt.encode({"iat": now - 60, "exp": now + 540, "iss": app_id}, private_key, algorithm="RS256")


def normalize_private_key(value: str) -> str:
    raw = _strip_matching_quotes(value.strip())
    candidate = _normalize_private_key_text(raw)
    if _is_private_key_pem(candidate):
        return candidate

    decoded = _decode_base64_private_key_candidate(raw)
    if decoded is None:
        return candidate

    decoded_candidate = _normalize_private_key_text(_strip_matching_quotes(decoded.strip()))
    return decoded_candidate if _is_private_key_pem(decoded_candidate) else candidate


def _decode_base64_private_key_candidate(value: str) -> str | None:
    compact = re.sub(r"\s+", "", value)
    if not compact:
        return None

    padded = compact + ("=" * ((4 - len(compact) % 4) % 4))
    for decoder in (base64.b64decode, base64.urlsafe_b64decode):
        try:
            return decoder(padded).decode("utf-8")
        except Exception:
            continue
    return None


def _strip_matching_quotes(value: str) -> str:
    if len(value) >= 2 and ((value[0] == value[-1] == "\"") or (value[0] == value[-1] == "'")):
        return value[1:-1].strip()
    return value


def _normalize_private_key_text(value: str) -> str:
    return value.strip().replace("\r\n", "\n").replace("\r", "\n").replace("\\n", "\n")


def _is_private_key_pem(value: str) -> bool:
    return bool(re.match(r"^-----BEGIN (?:RSA )?PRIVATE KEY-----\n[\s\S]+\n-----END (?:RSA )?PRIVATE KEY-----$", value))


def split_repository_full_name(value: str) -> tuple[str, str]:
    owner, repo = value.split("/", 1)
    return urllib.parse.quote(owner, safe=""), urllib.parse.quote(repo, safe="")


def _build_diff_artifact(
    context: ReviewContext,
    review_run_id: str,
    changed_files: Sequence[ChangedFile],
    skipped_files: Sequence[SkippedFile],
) -> dict[str, Any]:
    return {
        "schemaVersion": DIFF_ARTIFACT_SCHEMA_VERSION,
        "reviewRunId": review_run_id,
        "repositoryFullName": context.repository_full_name,
        "pullRequestNumber": context.pull_request_number,
        "baseSha": context.base_sha,
        "headSha": context.head_sha,
        "files": [
            {
                "path": file.path,
                "previousPath": file.previous_path,
                "status": file.status,
                "additions": file.additions,
                "deletions": file.deletions,
                "language": file.language,
                "patch": file.patch,
                "headContentSha256": hashlib.sha256((file.content or "").encode("utf-8")).hexdigest() if file.content else None,
                "sizeBytes": file.size_bytes,
                "changedNewLines": list(file.changed_new_lines),
                "hunks": list(file.hunks),
            }
            for file in changed_files
        ],
        "skippedFiles": [
            {
                "path": file.path,
                "previousPath": file.previous_path,
                "status": file.status,
                "reason": file.reason,
                "detail": file.detail,
                "excludedFromSemgrep": file.excluded_from_semgrep,
                "excludedFromTreeSitter": file.excluded_from_tree_sitter,
                "excludedFromLlmContext": file.excluded_from_llm_context,
            }
            for file in skipped_files
        ],
    }


def _run_tree_sitter(review_run_id: str, changed_files: Sequence[ChangedFile]) -> dict[str, Any]:
    files = [
        SemanticExtractionFile(
            path=file.path,
            content=file.content or "",
            changed_lines=tuple(file.changed_new_lines),
            hunks=tuple(ChangedHunk(new_start=hunk["newStart"], new_line_count=hunk["newLineCount"]) for hunk in file.hunks),
        )
        for file in changed_files
        if file.content is not None
    ]
    if not files:
        return {"schemaVersion": TREE_SITTER_ARTIFACT_SCHEMA_VERSION, "reviewRunId": review_run_id, "parserVersion": None, "files": []}
    return extract_tree_sitter_artifact(review_run_id=review_run_id, files=files)


def _empty_semgrep_artifact(review_run_id: str, skipped_files: Sequence[SkippedFile]) -> dict[str, Any]:
    return {
        "schemaVersion": "semgrep-artifact/v1",
        "reviewRunId": review_run_id,
        "toolVersion": None,
        "exitCode": 0,
        "durationMs": 0,
        "findings": [],
        "errors": [],
        "paths": {"scanned": [], "skipped": [_skipped_to_semgrep_path(file) for file in skipped_files]},
    }


def _semgrep_failure_artifact(review_run_id: str, code: str, message: str) -> dict[str, Any]:
    return {
        "schemaVersion": "semgrep-artifact/v1",
        "reviewRunId": review_run_id,
        "toolVersion": None,
        "exitCode": 127,
        "durationMs": 0,
        "findings": [],
        "errors": [{"code": code, "message": message, "path": None, "severity": "error"}],
        "paths": {"scanned": [], "skipped": []},
    }


def _read_github_file(value: Any) -> GitHubFile:
    item = _read_object(value)
    return GitHubFile(
        path=_read_str(item.get("filename"), "unknown"),
        previous_path=_read_optional_str(item.get("previous_filename")),
        status=_read_str(item.get("status"), "unknown"),
        additions=_read_int(item.get("additions"), 0),
        deletions=_read_int(item.get("deletions"), 0),
        patch=_read_optional_str(item.get("patch")),
        size_bytes=_read_optional_int(item.get("size")),
    )


def _skipped(file: GitHubFile, status: str, reason: str, detail: str) -> SkippedFile:
    return SkippedFile(
        path=file.path,
        previous_path=file.previous_path,
        status=status,
        reason=reason,
        detail=detail,
        excluded_from_semgrep=True,
        excluded_from_tree_sitter=True,
        excluded_from_llm_context=True,
    )


def _skipped_to_semgrep_path(file: SkippedFile) -> dict[str, Any]:
    return {"path": file.path, "reason": file.reason, "detail": file.detail}


def _normalize_file_status(value: str) -> str:
    normalized = value.lower()
    if normalized in DELETED_STATUSES:
        return "deleted"
    if normalized in {"added", "modified", "renamed", "copied"}:
        return normalized
    return "unknown"


def _language_for_path(path: str) -> str | None:
    name = Path(path).name.lower()
    if name in SUPPORTED_SPECIAL_FILENAMES:
        return SUPPORTED_SPECIAL_FILENAMES[name]
    return SUPPORTED_LANGUAGES_BY_EXTENSION.get(Path(path).suffix.lower())


def _is_infrastructure_path(path: str) -> bool:
    lower = path.lower()
    return lower.startswith((".github/", "infra/", "deploy/", "terraform/")) or Path(lower).name in {
        "dockerfile",
        "docker-compose.yml",
        "docker-compose.prod.yml",
    }


def _semgrep_category(finding: Mapping[str, Any]) -> str:
    rule_id = _read_str(finding.get("ruleId"), "").lower()
    metadata = _read_object(finding.get("metadata"))
    if "security" in rule_id or metadata.get("cwe") or metadata.get("owasp"):
        return "security"
    if "performance" in rule_id:
        return "performance"
    if "test" in rule_id:
        return "test"
    return "bug"


def _semgrep_evidence(finding: Mapping[str, Any]) -> dict[str, Any]:
    start = _read_object(finding.get("start"))
    end = _read_object(finding.get("end"))
    return {
        "source": "semgrep",
        "artifactId": _read_str(finding.get("ruleId"), "semgrep"),
        "path": _read_str(finding.get("path"), ""),
        "lineRange": {
            "startLine": _read_int(start.get("line"), 1),
            "endLine": _read_int(end.get("line"), _read_int(start.get("line"), 1)),
        },
        "excerpt": _read_str(finding.get("lines"), "")[:1000],
    }


def _render_semgrep_finding(value: Any) -> str:
    finding = _read_object(value)
    start = _read_object(finding.get("start"))
    path = _read_str(finding.get("path"), "unknown")
    line = _read_int(start.get("line"), 1)
    severity = _read_str(finding.get("severity"), "info").capitalize()
    message = _read_str(finding.get("message"), "Semgrep finding")
    rule_id = _read_str(finding.get("ruleId"), "unknown")
    return f"{severity}: {message} (`{path}:{line}`, `{rule_id}`)"


def _build_semgrep_inline_review_comments(
    *,
    semgrep_artifact: Mapping[str, Any],
    changed_files: Sequence[ChangedFile],
    max_comments: int,
) -> list[dict[str, Any]]:
    if max_comments <= 0:
        return []

    changed_lines_by_path = {file.path: set(file.changed_new_lines) for file in changed_files}
    candidates: list[dict[str, Any]] = []

    for finding in _read_list(semgrep_artifact.get("findings")):
        item = _read_object(finding)
        path = _read_str(item.get("path"), "")
        start = _read_object(item.get("start"))
        line = _read_optional_positive_int(start.get("line"))
        if not path or line is None:
            continue
        if line not in changed_lines_by_path.get(path, set()):
            continue

        candidates.append(
            {
                "findingId": _read_str(item.get("id"), _dedupe_hash(item)),
                "path": path,
                "line": line,
                "severity": _read_str(item.get("severity"), "info"),
                "body": _render_inline_semgrep_comment(item),
                "_rank": _severity_rank(_read_str(item.get("severity"), "info")),
            }
        )

    candidates.sort(key=lambda candidate: (-_read_int(candidate.get("_rank"), 0), _read_str(candidate.get("path"), ""), _read_int(candidate.get("line"), 0)))
    return [{key: value for key, value in candidate.items() if key != "_rank"} for candidate in candidates[:max_comments]]


def _render_inline_semgrep_comment(finding: Mapping[str, Any]) -> str:
    severity = _read_str(finding.get("severity"), "info")
    rule_id = _read_str(finding.get("ruleId"), "semgrep")
    message = _read_str(finding.get("message"), "Semgrep finding")
    lines = _read_str(finding.get("lines"), "")
    metadata = _read_object(finding.get("metadata"))
    remediation = _read_optional_str(metadata.get("remediation")) or _read_optional_str(finding.get("fix"))
    alert = "CAUTION" if severity in {"critical", "high"} else "WARNING" if severity == "medium" else "NOTE"
    language = _inline_comment_language(_read_str(finding.get("path"), ""))

    body = [
        f"### {message}",
        "",
        f"> [!{alert}]",
        f"> **{severity.upper()}** Semgrep rule `{rule_id}` flagged this changed line.",
    ]
    if lines.strip():
        body.extend(
            [
                "",
                "**Flagged code:**",
                "",
                f"```{language}",
                lines.strip()[:1200],
                "```",
            ]
        )

    body.extend(
        [
            "",
            "**Why this matters:**",
            message,
            "",
            "**Suggested fix:**",
            remediation or "Review this changed line and update it to satisfy the Semgrep rule before merging.",
        ]
    )
    return "\n".join(body)


def _inline_comment_language(path: str) -> str:
    extension = Path(path).suffix.lower()
    return {
        ".go": "go",
        ".java": "java",
        ".js": "javascript",
        ".jsx": "jsx",
        ".py": "python",
        ".ts": "typescript",
        ".tsx": "tsx",
        ".yaml": "yaml",
        ".yml": "yaml",
    }.get(extension, "")


def _severity_rank(severity: str) -> int:
    return {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}.get(severity, 0)


def _match_published_inline_comments(
    review_id: int,
    selected_comments: Sequence[Mapping[str, Any]],
    review_comments: Sequence[Any],
) -> list[PublishedInlineComment]:
    remaining = [_read_object(comment) for comment in review_comments]
    published: list[PublishedInlineComment] = []

    for selected in selected_comments:
        selected_body = _read_str(selected.get("body"), "")
        selected_path = _read_str(selected.get("path"), "")
        selected_line = _read_int(selected.get("line"), 1)
        match_index = next(
            (
                index
                for index, comment in enumerate(remaining)
                if _read_str(comment.get("body"), "") == selected_body
                and _read_str(comment.get("path"), "") == selected_path
                and _read_int(comment.get("line"), 0) == selected_line
                and isinstance(comment.get("id"), int)
            ),
            None,
        )
        if match_index is None:
            raise ReviewPipelineError("github_response_invalid", "GitHub review comments response did not include every inline comment id.")
        match = remaining.pop(match_index)
        published.append(
            PublishedInlineComment(
                finding_id=_read_str(selected.get("findingId"), ""),
                github_review_id=review_id,
                github_comment_id=int(match["id"]),
                file_path=selected_path,
                line=selected_line,
                body=selected_body,
                dry_run=False,
            )
        )

    return published


def _semgrep_scanned_paths(semgrep_artifact: Mapping[str, Any]) -> list[str]:
    paths = _read_object(semgrep_artifact.get("paths"))
    return [_read_str(path, "") for path in _read_list(paths.get("scanned")) if _read_str(path, "")]


def _semgrep_skipped_paths(semgrep_artifact: Mapping[str, Any]) -> list[Any]:
    paths = _read_object(semgrep_artifact.get("paths"))
    return _read_list(paths.get("skipped"))


def _tree_sitter_parsed_count(tree_sitter_artifact: Mapping[str, Any]) -> int:
    tree_files = _read_list(tree_sitter_artifact.get("files"))
    return sum(1 for file in tree_files if _read_str(_read_object(file).get("parseStatus"), "") == "parsed")


def _render_scan_path_block(title: str, values: Sequence[str]) -> list[str]:
    visible_values = [value for value in values if value][:12]
    hidden_count = max(0, len(values) - len(visible_values))
    lines = ["", f"<details>", f"<summary>{title}</summary>", ""]
    lines.extend(f"- `{value}`" for value in visible_values)
    if hidden_count:
        lines.append(f"- ...and {hidden_count} more")
    lines.extend(["", "</details>"])
    return lines


def _format_semgrep_skipped_paths(values: Sequence[Any]) -> list[str]:
    formatted: list[str] = []
    for value in values:
        item = _read_object(value)
        path = _read_str(item.get("path"), "")
        if not path:
            continue
        reason = _read_str(item.get("reason"), "skipped")
        formatted.append(f"{path} - {reason}")
    return formatted


def _render_semgrep_error_block(errors: Sequence[Any]) -> list[str]:
    lines = ["", "<details open>", "<summary>Semgrep scan errors</summary>", ""]
    for error in errors[:5]:
        item = _read_object(error)
        message = _single_line(_read_str(item.get("message"), "Semgrep scan failed"))[:500]
        code = _read_str(item.get("code"), "error")
        lines.append(f"- `{code}`: {message}")
    hidden_count = max(0, len(errors) - 5)
    if hidden_count:
        lines.append(f"- ...and {hidden_count} more")
    lines.extend(["", "</details>"])
    return lines


def _risk_level(findings: Sequence[Any], errors: Sequence[Any]) -> str:
    severities = [_read_str(_read_object(finding).get("severity"), "info") for finding in findings]
    if any(severity in {"critical", "high"} for severity in severities):
        return "high"
    if any(severity == "medium" for severity in severities) or errors:
        return "medium"
    return "low"


def _changed_components(files: Sequence[ChangedFile]) -> list[str]:
    counts: Counter[str] = Counter()
    for file in files:
        parts = file.path.split("/")
        component = "/".join(parts[:2]) if len(parts) > 1 else parts[0]
        counts[component] += 1
    return [f"`{name}` ({count} file{'s' if count != 1 else ''})" for name, count in counts.most_common(8)]


def _test_suggestions(files: Sequence[ChangedFile], findings: Sequence[Any]) -> list[str]:
    languages = {file.language for file in files if file.language}
    suggestions: list[str] = []
    if "typescript" in languages or "javascript" in languages:
        suggestions.append("Run the affected TypeScript/JavaScript unit tests and type checks.")
    if "python" in languages:
        suggestions.append("Run the affected Python tests with pytest.")
    if any(_is_infrastructure_path(file.path) for file in files):
        suggestions.append("Run deployment or compose validation for the changed infrastructure files.")
    if findings:
        suggestions.append("Add or update tests that exercise each Semgrep finding before merging.")
    if not suggestions:
        suggestions.append("Run the project test suite that owns the changed files.")
    return suggestions


def _single_line(value: str) -> str:
    return " ".join(value.replace("\r", " ").replace("\n", " ").split())


def _read_required_env(env: Mapping[str, str], name: str) -> str:
    value = env.get(name, "").strip()
    if not value:
        raise ReviewPipelineError("missing_worker_env", f"{name} is required for the real review pipeline.")
    return value


def _read_bool(value: str | None, *, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _read_positive_int(value: str | None, default: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def _read_object(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _read_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _read_str(value: Any, default: str) -> str:
    return value if isinstance(value, str) and value else default


def _read_optional_str(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def _read_int(value: Any, default: int) -> int:
    return value if isinstance(value, int) else default


def _read_optional_int(value: Any) -> int | None:
    return value if isinstance(value, int) else None


def _read_optional_positive_int(value: Any) -> int | None:
    return value if isinstance(value, int) and value > 0 else None


def _dedupe_hash(value: Mapping[str, Any]) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode("utf-8")).hexdigest()


def _body_hash(review_run_id: str, body: str) -> str:
    return hashlib.sha256(f"{review_run_id}\0{body}".encode("utf-8")).hexdigest()


def _log(event: str, **fields: Any) -> None:
    print(json.dumps({"event": event, **fields}, sort_keys=True), flush=True)
