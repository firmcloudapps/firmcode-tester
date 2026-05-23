from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any


REVIEW_JOB_INPUT_SCHEMA_VERSION = "review-job-input/v1"
DIFF_ARTIFACT_SCHEMA_VERSION = "diff-artifact/v1"
SEMGREP_ARTIFACT_SCHEMA_VERSION = "semgrep-artifact/v1"
TREE_SITTER_ARTIFACT_SCHEMA_VERSION = "tree-sitter-artifact/v1"
CI_LOG_ARTIFACT_SCHEMA_VERSION = "ci-log-artifact/v1"
LLM_REVIEW_OUTPUT_SCHEMA_VERSION = "llm-review-output/v1"
PUBLISH_PAYLOAD_SCHEMA_VERSION = "publish-payload/v1"

FILE_STATUSES = {"added", "deleted", "modified", "renamed", "copied", "unknown"}
SEVERITIES = {"info", "low", "medium", "high", "critical"}
FINDING_SOURCES = {"llm", "semgrep", "tree_sitter", "ci", "policy"}
FINDING_CATEGORIES = {
    "bug",
    "security",
    "performance",
    "maintainability",
    "testing",
    "ci",
    "infrastructure",
    "documentation",
}
CI_LOG_UNAVAILABLE_REASONS = {
    "checks_unavailable",
    "github_request_failed",
    "log_expired",
    "log_not_found",
    "missing_actions_permission",
    "missing_checks_permission",
    "not_github_actions",
    "workflow_job_unavailable",
    "workflow_run_unavailable",
}


class ContractValidationError(ValueError):
    def __init__(self, errors: list[str]) -> None:
        super().__init__("; ".join(errors))
        self.errors = errors


@dataclass(frozen=True)
class ReviewJobInput:
    schema_version: str
    delivery_id: str
    review_run_id: str
    repository_id: str
    pull_request_id: str
    pull_request_number: int
    head_sha: str
    trigger_event: str

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "ReviewJobInput":
        errors: list[str] = []
        _read_literal(value, "schemaVersion", REVIEW_JOB_INPUT_SCHEMA_VERSION, errors)
        payload = cls(
            schema_version=REVIEW_JOB_INPUT_SCHEMA_VERSION,
            delivery_id=_read_non_empty_str(value, "deliveryId", errors),
            review_run_id=_read_non_empty_str(value, "reviewRunId", errors),
            repository_id=_read_non_empty_str(value, "repositoryId", errors),
            pull_request_id=_read_non_empty_str(value, "pullRequestId", errors),
            pull_request_number=_read_positive_int(value, "pullRequestNumber", errors),
            head_sha=_read_non_empty_str(value, "headSha", errors),
            trigger_event=_read_non_empty_str(value, "triggerEvent", errors),
        )
        _raise_if_errors(errors)
        return payload


@dataclass(frozen=True)
class Position:
    line: int
    column: int
    offset: int | None = None


@dataclass(frozen=True)
class LineRange:
    start_line: int
    end_line: int


@dataclass(frozen=True)
class DiffLine:
    type: str
    content: str
    old_line_number: int | None
    new_line_number: int | None


@dataclass(frozen=True)
class DiffHunk:
    old_start: int
    old_line_count: int
    new_start: int
    new_line_count: int
    section_header: str
    lines: list[DiffLine]


@dataclass(frozen=True)
class ChangedFileArtifact:
    path: str
    previous_path: str | None
    status: str
    additions: int
    deletions: int
    language: str | None
    patch: str | None
    head_content_sha256: str | None
    size_bytes: int | None
    changed_new_lines: list[int]
    hunks: list[DiffHunk]


@dataclass(frozen=True)
class SkippedFileArtifact:
    path: str
    previous_path: str | None
    status: str
    reason: str
    detail: str
    excluded_from_semgrep: bool
    excluded_from_tree_sitter: bool
    excluded_from_llm_context: bool


@dataclass(frozen=True)
class DiffArtifact:
    schema_version: str
    review_run_id: str
    repository_full_name: str
    pull_request_number: int
    base_sha: str
    head_sha: str
    files: list[ChangedFileArtifact]
    skipped_files: list[SkippedFileArtifact]

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "DiffArtifact":
        errors: list[str] = []
        _read_literal(value, "schemaVersion", DIFF_ARTIFACT_SCHEMA_VERSION, errors)
        artifact = cls(
            schema_version=DIFF_ARTIFACT_SCHEMA_VERSION,
            review_run_id=_read_non_empty_str(value, "reviewRunId", errors),
            repository_full_name=_read_non_empty_str(value, "repositoryFullName", errors),
            pull_request_number=_read_positive_int(value, "pullRequestNumber", errors),
            base_sha=_read_non_empty_str(value, "baseSha", errors),
            head_sha=_read_non_empty_str(value, "headSha", errors),
            files=[
                _read_changed_file(file_value, f"files[{index}]", errors)
                for index, file_value in enumerate(_read_list(value, "files", errors))
            ],
            skipped_files=[
                _read_skipped_file(file_value, f"skippedFiles[{index}]", errors)
                for index, file_value in enumerate(_read_list(value, "skippedFiles", errors))
            ],
        )
        _raise_if_errors(errors)
        return artifact


@dataclass(frozen=True)
class SemgrepFinding:
    id: str
    rule_id: str
    path: str
    start: Position
    end: Position
    severity: str
    source_severity: str
    message: str
    fingerprint: str | None
    lines: str
    metadata: Mapping[str, Any]
    fix: str | None


@dataclass(frozen=True)
class SemgrepError:
    code: str
    message: str
    path: str | None
    severity: str


@dataclass(frozen=True)
class SemgrepSkippedPath:
    path: str
    reason: str
    detail: str | None


@dataclass(frozen=True)
class SemgrepArtifact:
    schema_version: str
    review_run_id: str
    tool_version: str | None
    exit_code: int
    duration_ms: int
    findings: list[SemgrepFinding]
    errors: list[SemgrepError]
    scanned_paths: list[str]
    skipped_paths: list[SemgrepSkippedPath]

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "SemgrepArtifact":
        errors: list[str] = []
        _read_literal(value, "schemaVersion", SEMGREP_ARTIFACT_SCHEMA_VERSION, errors)
        paths = _read_object(value, "paths", errors)
        artifact = cls(
            schema_version=SEMGREP_ARTIFACT_SCHEMA_VERSION,
            review_run_id=_read_non_empty_str(value, "reviewRunId", errors),
            tool_version=_read_nullable_str(value, "toolVersion", errors),
            exit_code=_read_int(value, "exitCode", errors),
            duration_ms=_read_non_negative_int(value, "durationMs", errors),
            findings=[
                _read_semgrep_finding(finding, f"findings[{index}]", errors)
                for index, finding in enumerate(_read_list(value, "findings", errors))
            ],
            errors=[
                _read_semgrep_error(error, f"errors[{index}]", errors)
                for index, error in enumerate(_read_list(value, "errors", errors))
            ],
            scanned_paths=[
                _read_value_non_empty_str(path, f"paths.scanned[{index}]", errors)
                for index, path in enumerate(_read_list(paths, "scanned", errors, "paths.scanned"))
            ],
            skipped_paths=[
                _read_semgrep_skipped_path(path, f"paths.skipped[{index}]", errors)
                for index, path in enumerate(_read_list(paths, "skipped", errors, "paths.skipped"))
            ],
        )
        _raise_if_errors(errors)
        return artifact


@dataclass(frozen=True)
class TreeSitterSymbol:
    name: str
    kind: str
    range: LineRange
    start_byte: int
    end_byte: int
    changed: bool


@dataclass(frozen=True)
class TreeSitterImport:
    source: str
    symbols: list[str]
    line: int


@dataclass(frozen=True)
class TreeSitterHunkScope:
    path: str
    hunk_new_start: int
    hunk_new_end: int
    enclosing_symbol: str | None


@dataclass(frozen=True)
class TreeSitterFileArtifact:
    path: str
    language: str
    parser: str
    parse_status: str
    has_error: bool
    missing_node_count: int
    error_node_count: int
    symbols: list[TreeSitterSymbol]
    imports: list[TreeSitterImport]
    hunk_scopes: list[TreeSitterHunkScope]
    errors: list[str]


@dataclass(frozen=True)
class TreeSitterArtifact:
    schema_version: str
    review_run_id: str
    parser_version: str | None
    files: list[TreeSitterFileArtifact]

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "TreeSitterArtifact":
        errors: list[str] = []
        _read_literal(value, "schemaVersion", TREE_SITTER_ARTIFACT_SCHEMA_VERSION, errors)
        artifact = cls(
            schema_version=TREE_SITTER_ARTIFACT_SCHEMA_VERSION,
            review_run_id=_read_non_empty_str(value, "reviewRunId", errors),
            parser_version=_read_nullable_str(value, "parserVersion", errors),
            files=[
                _read_tree_sitter_file(file_value, f"files[{index}]", errors)
                for index, file_value in enumerate(_read_list(value, "files", errors))
            ],
        )
        _raise_if_errors(errors)
        return artifact


@dataclass(frozen=True)
class CiCheckRun:
    id: int
    name: str
    status: str
    conclusion: str
    app_slug: str | None
    details_url: str | None
    html_url: str | None
    workflow_run_id: int | None
    workflow_job_id: int | None
    started_at: str | None
    completed_at: str | None


@dataclass(frozen=True)
class CiLogEntry:
    check_run_id: int
    name: str
    source: str
    workflow_run_id: int | None
    workflow_job_id: int
    content: str
    original_bytes: int
    redacted_bytes: int
    stored_bytes: int
    truncated: bool
    redacted: bool


@dataclass(frozen=True)
class UnavailableCiLog:
    check_run_id: int | None
    name: str | None
    reason: str
    detail: str


@dataclass(frozen=True)
class CiLogArtifact:
    schema_version: str
    review_run_id: str
    repository_full_name: str
    pull_request_number: int
    head_sha: str
    check_runs: list[CiCheckRun]
    logs: list[CiLogEntry]
    unavailable_logs: list[UnavailableCiLog]

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "CiLogArtifact":
        errors: list[str] = []
        _read_literal(value, "schemaVersion", CI_LOG_ARTIFACT_SCHEMA_VERSION, errors)
        artifact = cls(
            schema_version=CI_LOG_ARTIFACT_SCHEMA_VERSION,
            review_run_id=_read_non_empty_str(value, "reviewRunId", errors),
            repository_full_name=_read_non_empty_str(value, "repositoryFullName", errors),
            pull_request_number=_read_positive_int(value, "pullRequestNumber", errors),
            head_sha=_read_non_empty_str(value, "headSha", errors),
            check_runs=[
                _read_ci_check_run(check_run, f"checkRuns[{index}]", errors)
                for index, check_run in enumerate(_read_list(value, "checkRuns", errors))
            ],
            logs=[
                _read_ci_log_entry(log, f"logs[{index}]", errors)
                for index, log in enumerate(_read_list(value, "logs", errors))
            ],
            unavailable_logs=[
                _read_unavailable_ci_log(log, f"unavailableLogs[{index}]", errors)
                for index, log in enumerate(_read_list(value, "unavailableLogs", errors))
            ],
        )
        _raise_if_errors(errors)
        return artifact


@dataclass(frozen=True)
class FindingEvidence:
    source: str
    artifact_id: str | None
    path: str | None
    line_range: LineRange | None
    excerpt: str


@dataclass(frozen=True)
class ReviewFinding:
    id: str
    source: str
    category: str
    severity: str
    confidence: float
    path: str | None
    line_range: LineRange | None
    title: str
    body: str
    evidence: list[FindingEvidence]
    suggested_fix: str | None


@dataclass(frozen=True)
class LlmReviewOutput:
    schema_version: str
    prompt_id: str
    prompt_version: str
    model: str
    summary: str
    risk_level: str
    changed_components: list[str]
    inline_findings: list[ReviewFinding]
    summary_findings: list[ReviewFinding]
    test_suggestions: list[str]
    ci_explanation: str | None
    confidence: float

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "LlmReviewOutput":
        errors: list[str] = []
        _read_literal(value, "schemaVersion", LLM_REVIEW_OUTPUT_SCHEMA_VERSION, errors)
        output = cls(
            schema_version=LLM_REVIEW_OUTPUT_SCHEMA_VERSION,
            prompt_id=_read_non_empty_str(value, "promptId", errors),
            prompt_version=_read_non_empty_str(value, "promptVersion", errors),
            model=_read_non_empty_str(value, "model", errors),
            summary=_read_non_empty_str(value, "summary", errors),
            risk_level=_read_literal_from_set(value, "riskLevel", {"low", "medium", "high"}, errors),
            changed_components=[
                _read_value_non_empty_str(component, f"changedComponents[{index}]", errors)
                for index, component in enumerate(_read_list(value, "changedComponents", errors))
            ],
            inline_findings=[
                _read_review_finding(finding, f"inlineFindings[{index}]", errors)
                for index, finding in enumerate(_read_list(value, "inlineFindings", errors))
            ],
            summary_findings=[
                _read_review_finding(finding, f"summaryFindings[{index}]", errors)
                for index, finding in enumerate(_read_list(value, "summaryFindings", errors))
            ],
            test_suggestions=[
                _read_value_non_empty_str(suggestion, f"testSuggestions[{index}]", errors)
                for index, suggestion in enumerate(_read_list(value, "testSuggestions", errors))
            ],
            ci_explanation=_read_nullable_str(value, "ciExplanation", errors),
            confidence=_read_confidence(value, "confidence", errors),
        )
        _raise_if_errors(errors)
        return output


@dataclass(frozen=True)
class PublishInlineComment:
    finding_id: str
    path: str
    line: int
    body: str
    severity: str


@dataclass(frozen=True)
class PublishPayload:
    schema_version: str
    review_run_id: str
    repository_full_name: str
    pull_request_number: int
    head_sha: str
    mode: str
    summary_body: str
    inline_comments: list[PublishInlineComment]

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "PublishPayload":
        errors: list[str] = []
        _read_literal(value, "schemaVersion", PUBLISH_PAYLOAD_SCHEMA_VERSION, errors)
        payload = cls(
            schema_version=PUBLISH_PAYLOAD_SCHEMA_VERSION,
            review_run_id=_read_non_empty_str(value, "reviewRunId", errors),
            repository_full_name=_read_non_empty_str(value, "repositoryFullName", errors),
            pull_request_number=_read_positive_int(value, "pullRequestNumber", errors),
            head_sha=_read_non_empty_str(value, "headSha", errors),
            mode=_read_literal_from_set(value, "mode", {"dry_run", "publish"}, errors),
            summary_body=_read_non_empty_str(value, "summaryBody", errors),
            inline_comments=[
                _read_publish_inline_comment(comment, f"inlineComments[{index}]", errors)
                for index, comment in enumerate(_read_list(value, "inlineComments", errors))
            ],
        )
        _raise_if_errors(errors)
        return payload


def _read_changed_file(value: Any, path: str, errors: list[str]) -> ChangedFileArtifact:
    item = _as_object(value, path, errors)
    return ChangedFileArtifact(
        path=_read_non_empty_str(item, "path", errors, path),
        previous_path=_read_nullable_str(item, "previousPath", errors, path),
        status=_read_literal_from_set(item, "status", FILE_STATUSES, errors, path),
        additions=_read_non_negative_int(item, "additions", errors, path),
        deletions=_read_non_negative_int(item, "deletions", errors, path),
        language=_read_nullable_str(item, "language", errors, path),
        patch=_read_nullable_str(item, "patch", errors, path),
        head_content_sha256=_read_nullable_str(item, "headContentSha256", errors, path),
        size_bytes=_read_nullable_non_negative_int(item, "sizeBytes", errors, path),
        changed_new_lines=[
            _read_value_positive_int(line, f"{path}.changedNewLines[{index}]", errors)
            for index, line in enumerate(_read_list(item, "changedNewLines", errors, f"{path}.changedNewLines"))
        ],
        hunks=[
            _read_diff_hunk(hunk, f"{path}.hunks[{index}]", errors)
            for index, hunk in enumerate(_read_list(item, "hunks", errors, f"{path}.hunks"))
        ],
    )


def _read_diff_hunk(value: Any, path: str, errors: list[str]) -> DiffHunk:
    item = _as_object(value, path, errors)
    return DiffHunk(
        old_start=_read_positive_int(item, "oldStart", errors, path),
        old_line_count=_read_non_negative_int(item, "oldLineCount", errors, path),
        new_start=_read_positive_int(item, "newStart", errors, path),
        new_line_count=_read_non_negative_int(item, "newLineCount", errors, path),
        section_header=_read_str(item, "sectionHeader", errors, path),
        lines=[
            _read_diff_line(line, f"{path}.lines[{index}]", errors)
            for index, line in enumerate(_read_list(item, "lines", errors, f"{path}.lines"))
        ],
    )


def _read_diff_line(value: Any, path: str, errors: list[str]) -> DiffLine:
    item = _as_object(value, path, errors)
    return DiffLine(
        type=_read_literal_from_set(item, "type", {"context", "addition", "deletion"}, errors, path),
        content=_read_str(item, "content", errors, path),
        old_line_number=_read_nullable_positive_int(item, "oldLineNumber", errors, path),
        new_line_number=_read_nullable_positive_int(item, "newLineNumber", errors, path),
    )


def _read_skipped_file(value: Any, path: str, errors: list[str]) -> SkippedFileArtifact:
    item = _as_object(value, path, errors)
    return SkippedFileArtifact(
        path=_read_non_empty_str(item, "path", errors, path),
        previous_path=_read_nullable_str(item, "previousPath", errors, path),
        status=_read_literal_from_set(item, "status", FILE_STATUSES, errors, path),
        reason=_read_non_empty_str(item, "reason", errors, path),
        detail=_read_non_empty_str(item, "detail", errors, path),
        excluded_from_semgrep=_read_bool(item, "excludedFromSemgrep", errors, path),
        excluded_from_tree_sitter=_read_bool(item, "excludedFromTreeSitter", errors, path),
        excluded_from_llm_context=_read_bool(item, "excludedFromLlmContext", errors, path),
    )


def _read_semgrep_finding(value: Any, path: str, errors: list[str]) -> SemgrepFinding:
    item = _as_object(value, path, errors)
    metadata = item.get("metadata")
    if not isinstance(metadata, Mapping):
        errors.append(f"{path}.metadata must be an object")
        metadata = {}
    return SemgrepFinding(
        id=_read_non_empty_str(item, "id", errors, path),
        rule_id=_read_non_empty_str(item, "ruleId", errors, path),
        path=_read_non_empty_str(item, "path", errors, path),
        start=_read_position(item.get("start"), f"{path}.start", errors, include_offset=True),
        end=_read_position(item.get("end"), f"{path}.end", errors, include_offset=True),
        severity=_read_literal_from_set(item, "severity", SEVERITIES, errors, path),
        source_severity=_read_non_empty_str(item, "sourceSeverity", errors, path),
        message=_read_non_empty_str(item, "message", errors, path),
        fingerprint=_read_nullable_str(item, "fingerprint", errors, path),
        lines=_read_str(item, "lines", errors, path),
        metadata=metadata,
        fix=_read_nullable_str(item, "fix", errors, path),
    )


def _read_semgrep_error(value: Any, path: str, errors: list[str]) -> SemgrepError:
    item = _as_object(value, path, errors)
    return SemgrepError(
        code=_read_non_empty_str(item, "code", errors, path),
        message=_read_non_empty_str(item, "message", errors, path),
        path=_read_nullable_str(item, "path", errors, path),
        severity=_read_literal_from_set(item, "severity", {"info", "warning", "error"}, errors, path),
    )


def _read_semgrep_skipped_path(value: Any, path: str, errors: list[str]) -> SemgrepSkippedPath:
    item = _as_object(value, path, errors)
    return SemgrepSkippedPath(
        path=_read_non_empty_str(item, "path", errors, path),
        reason=_read_non_empty_str(item, "reason", errors, path),
        detail=_read_nullable_str(item, "detail", errors, path),
    )


def _read_tree_sitter_file(value: Any, path: str, errors: list[str]) -> TreeSitterFileArtifact:
    item = _as_object(value, path, errors)
    return TreeSitterFileArtifact(
        path=_read_non_empty_str(item, "path", errors, path),
        language=_read_non_empty_str(item, "language", errors, path),
        parser=_read_non_empty_str(item, "parser", errors, path),
        parse_status=_read_literal_from_set(item, "parseStatus", {"parsed", "partial", "failed", "unsupported"}, errors, path),
        has_error=_read_bool(item, "hasError", errors, path),
        missing_node_count=_read_non_negative_int(item, "missingNodeCount", errors, path),
        error_node_count=_read_non_negative_int(item, "errorNodeCount", errors, path),
        symbols=[
            _read_tree_sitter_symbol(symbol, f"{path}.symbols[{index}]", errors)
            for index, symbol in enumerate(_read_list(item, "symbols", errors, f"{path}.symbols"))
        ],
        imports=[
            _read_tree_sitter_import(import_value, f"{path}.imports[{index}]", errors)
            for index, import_value in enumerate(_read_list(item, "imports", errors, f"{path}.imports"))
        ],
        hunk_scopes=[
            _read_tree_sitter_hunk_scope(scope, f"{path}.hunkScopes[{index}]", errors)
            for index, scope in enumerate(_read_list(item, "hunkScopes", errors, f"{path}.hunkScopes"))
        ],
        errors=[
            _read_value_non_empty_str(error, f"{path}.errors[{index}]", errors)
            for index, error in enumerate(_read_list(item, "errors", errors, f"{path}.errors"))
        ],
    )


def _read_tree_sitter_symbol(value: Any, path: str, errors: list[str]) -> TreeSitterSymbol:
    item = _as_object(value, path, errors)
    byte_range = _read_object(item, "byteRange", errors, path)
    return TreeSitterSymbol(
        name=_read_non_empty_str(item, "name", errors, path),
        kind=_read_non_empty_str(item, "kind", errors, path),
        range=_read_line_range(item.get("range"), f"{path}.range", errors),
        start_byte=_read_non_negative_int(byte_range, "startByte", errors, f"{path}.byteRange"),
        end_byte=_read_non_negative_int(byte_range, "endByte", errors, f"{path}.byteRange"),
        changed=_read_bool(item, "changed", errors, path),
    )


def _read_tree_sitter_import(value: Any, path: str, errors: list[str]) -> TreeSitterImport:
    item = _as_object(value, path, errors)
    return TreeSitterImport(
        source=_read_non_empty_str(item, "source", errors, path),
        symbols=[
            _read_value_non_empty_str(symbol, f"{path}.symbols[{index}]", errors)
            for index, symbol in enumerate(_read_list(item, "symbols", errors, f"{path}.symbols"))
        ],
        line=_read_positive_int(item, "line", errors, path),
    )


def _read_tree_sitter_hunk_scope(value: Any, path: str, errors: list[str]) -> TreeSitterHunkScope:
    item = _as_object(value, path, errors)
    return TreeSitterHunkScope(
        path=_read_non_empty_str(item, "path", errors, path),
        hunk_new_start=_read_positive_int(item, "hunkNewStart", errors, path),
        hunk_new_end=_read_positive_int(item, "hunkNewEnd", errors, path),
        enclosing_symbol=_read_nullable_str(item, "enclosingSymbol", errors, path),
    )


def _read_ci_check_run(value: Any, path: str, errors: list[str]) -> CiCheckRun:
    item = _as_object(value, path, errors)
    return CiCheckRun(
        id=_read_positive_int(item, "id", errors, path),
        name=_read_non_empty_str(item, "name", errors, path),
        status=_read_non_empty_str(item, "status", errors, path),
        conclusion=_read_non_empty_str(item, "conclusion", errors, path),
        app_slug=_read_nullable_str(item, "appSlug", errors, path),
        details_url=_read_nullable_str(item, "detailsUrl", errors, path),
        html_url=_read_nullable_str(item, "htmlUrl", errors, path),
        workflow_run_id=_read_nullable_positive_int(item, "workflowRunId", errors, path),
        workflow_job_id=_read_nullable_positive_int(item, "workflowJobId", errors, path),
        started_at=_read_nullable_str(item, "startedAt", errors, path),
        completed_at=_read_nullable_str(item, "completedAt", errors, path),
    )


def _read_ci_log_entry(value: Any, path: str, errors: list[str]) -> CiLogEntry:
    item = _as_object(value, path, errors)
    return CiLogEntry(
        check_run_id=_read_positive_int(item, "checkRunId", errors, path),
        name=_read_non_empty_str(item, "name", errors, path),
        source=_read_literal_from_set(item, "source", {"github_actions_job"}, errors, path),
        workflow_run_id=_read_nullable_positive_int(item, "workflowRunId", errors, path),
        workflow_job_id=_read_positive_int(item, "workflowJobId", errors, path),
        content=_read_str(item, "content", errors, path),
        original_bytes=_read_non_negative_int(item, "originalBytes", errors, path),
        redacted_bytes=_read_non_negative_int(item, "redactedBytes", errors, path),
        stored_bytes=_read_non_negative_int(item, "storedBytes", errors, path),
        truncated=_read_bool(item, "truncated", errors, path),
        redacted=_read_bool(item, "redacted", errors, path),
    )


def _read_unavailable_ci_log(value: Any, path: str, errors: list[str]) -> UnavailableCiLog:
    item = _as_object(value, path, errors)
    return UnavailableCiLog(
        check_run_id=_read_nullable_positive_int(item, "checkRunId", errors, path),
        name=_read_nullable_str(item, "name", errors, path),
        reason=_read_literal_from_set(item, "reason", CI_LOG_UNAVAILABLE_REASONS, errors, path),
        detail=_read_non_empty_str(item, "detail", errors, path),
    )


def _read_review_finding(value: Any, path: str, errors: list[str]) -> ReviewFinding:
    item = _as_object(value, path, errors)
    evidence = [
        _read_finding_evidence(evidence, f"{path}.evidence[{index}]", errors)
        for index, evidence in enumerate(_read_list(item, "evidence", errors, f"{path}.evidence"))
    ]
    if not evidence:
        errors.append(f"{path}.evidence must include at least one item")

    return ReviewFinding(
        id=_read_non_empty_str(item, "id", errors, path),
        source=_read_literal_from_set(item, "source", FINDING_SOURCES, errors, path),
        category=_read_literal_from_set(item, "category", FINDING_CATEGORIES, errors, path),
        severity=_read_literal_from_set(item, "severity", SEVERITIES, errors, path),
        confidence=_read_confidence(item, "confidence", errors, path),
        path=_read_nullable_str(item, "path", errors, path),
        line_range=_read_nullable_line_range(item.get("lineRange"), f"{path}.lineRange", errors),
        title=_read_non_empty_str(item, "title", errors, path),
        body=_read_non_empty_str(item, "body", errors, path),
        evidence=evidence,
        suggested_fix=_read_nullable_str(item, "suggestedFix", errors, path),
    )


def _read_finding_evidence(value: Any, path: str, errors: list[str]) -> FindingEvidence:
    item = _as_object(value, path, errors)
    return FindingEvidence(
        source=_read_literal_from_set(item, "source", FINDING_SOURCES, errors, path),
        artifact_id=_read_nullable_str(item, "artifactId", errors, path),
        path=_read_nullable_str(item, "path", errors, path),
        line_range=_read_nullable_line_range(item.get("lineRange"), f"{path}.lineRange", errors),
        excerpt=_read_non_empty_str(item, "excerpt", errors, path),
    )


def _read_publish_inline_comment(value: Any, path: str, errors: list[str]) -> PublishInlineComment:
    item = _as_object(value, path, errors)
    return PublishInlineComment(
        finding_id=_read_non_empty_str(item, "findingId", errors, path),
        path=_read_non_empty_str(item, "path", errors, path),
        line=_read_positive_int(item, "line", errors, path),
        body=_read_non_empty_str(item, "body", errors, path),
        severity=_read_literal_from_set(item, "severity", SEVERITIES, errors, path),
    )


def _read_position(value: Any, path: str, errors: list[str], *, include_offset: bool = False) -> Position:
    item = _as_object(value, path, errors)
    return Position(
        line=_read_positive_int(item, "line", errors, path),
        column=_read_non_negative_int(item, "column", errors, path),
        offset=_read_nullable_non_negative_int(item, "offset", errors, path) if include_offset else None,
    )


def _read_line_range(value: Any, path: str, errors: list[str]) -> LineRange:
    item = _as_object(value, path, errors)
    return LineRange(
        start_line=_read_positive_int(item, "startLine", errors, path),
        end_line=_read_positive_int(item, "endLine", errors, path),
    )


def _read_nullable_line_range(value: Any, path: str, errors: list[str]) -> LineRange | None:
    if value is None:
        return None
    return _read_line_range(value, path, errors)


def _read_literal(value: Mapping[str, Any], key: str, expected: str, errors: list[str], prefix: str | None = None) -> str:
    actual = value.get(key)
    path = _join(prefix, key)
    if actual != expected:
        errors.append(f"{path} must be {expected}")
    return expected


def _read_literal_from_set(
    value: Mapping[str, Any], key: str, expected: set[str], errors: list[str], prefix: str | None = None
) -> str:
    actual = value.get(key)
    path = _join(prefix, key)
    if isinstance(actual, str) and actual in expected:
        return actual
    errors.append(f"{path} must be one of {', '.join(sorted(expected))}")
    return ""


def _read_object(value: Mapping[str, Any], key: str, errors: list[str], prefix: str | None = None) -> Mapping[str, Any]:
    return _as_object(value.get(key), _join(prefix, key), errors)


def _as_object(value: Any, path: str, errors: list[str]) -> Mapping[str, Any]:
    if isinstance(value, Mapping):
        return value
    errors.append(f"{path} must be an object")
    return {}


def _read_list(value: Mapping[str, Any], key: str, errors: list[str], path: str | None = None) -> list[Any]:
    actual = value.get(key)
    field_path = path or key
    if isinstance(actual, list):
        return actual
    errors.append(f"{field_path} must be an array")
    return []


def _read_str(value: Mapping[str, Any], key: str, errors: list[str], prefix: str | None = None) -> str:
    actual = value.get(key)
    path = _join(prefix, key)
    if isinstance(actual, str):
        return actual
    errors.append(f"{path} must be a string")
    return ""


def _read_non_empty_str(value: Mapping[str, Any], key: str, errors: list[str], prefix: str | None = None) -> str:
    return _read_value_non_empty_str(value.get(key), _join(prefix, key), errors)


def _read_value_non_empty_str(value: Any, path: str, errors: list[str]) -> str:
    if isinstance(value, str) and value.strip():
        return value
    errors.append(f"{path} must be a non-empty string")
    return ""


def _read_nullable_str(value: Mapping[str, Any], key: str, errors: list[str], prefix: str | None = None) -> str | None:
    actual = value.get(key)
    path = _join(prefix, key)
    if actual is None:
        return None
    if isinstance(actual, str) and actual.strip():
        return actual
    errors.append(f"{path} must be a non-empty string or null")
    return None


def _read_bool(value: Mapping[str, Any], key: str, errors: list[str], prefix: str | None = None) -> bool:
    actual = value.get(key)
    path = _join(prefix, key)
    if isinstance(actual, bool):
        return actual
    errors.append(f"{path} must be a boolean")
    return False


def _read_int(value: Mapping[str, Any], key: str, errors: list[str], prefix: str | None = None) -> int:
    actual = value.get(key)
    path = _join(prefix, key)
    if isinstance(actual, int) and not isinstance(actual, bool):
        return actual
    errors.append(f"{path} must be an integer")
    return 0


def _read_positive_int(value: Mapping[str, Any], key: str, errors: list[str], prefix: str | None = None) -> int:
    return _read_value_positive_int(value.get(key), _join(prefix, key), errors)


def _read_value_positive_int(value: Any, path: str, errors: list[str]) -> int:
    if isinstance(value, int) and not isinstance(value, bool) and value > 0:
        return value
    errors.append(f"{path} must be a positive integer")
    return 1


def _read_non_negative_int(value: Mapping[str, Any], key: str, errors: list[str], prefix: str | None = None) -> int:
    actual = value.get(key)
    path = _join(prefix, key)
    if isinstance(actual, int) and not isinstance(actual, bool) and actual >= 0:
        return actual
    errors.append(f"{path} must be a non-negative integer")
    return 0


def _read_nullable_positive_int(value: Mapping[str, Any], key: str, errors: list[str], prefix: str | None = None) -> int | None:
    actual = value.get(key)
    path = _join(prefix, key)
    if actual is None:
        return None
    return _read_value_positive_int(actual, path, errors)


def _read_nullable_non_negative_int(
    value: Mapping[str, Any], key: str, errors: list[str], prefix: str | None = None
) -> int | None:
    actual = value.get(key)
    path = _join(prefix, key)
    if actual is None:
        return None
    if isinstance(actual, int) and not isinstance(actual, bool) and actual >= 0:
        return actual
    errors.append(f"{path} must be a non-negative integer or null")
    return None


def _read_confidence(value: Mapping[str, Any], key: str, errors: list[str], prefix: str | None = None) -> float:
    actual = value.get(key)
    path = _join(prefix, key)
    if isinstance(actual, (int, float)) and not isinstance(actual, bool) and 0 <= actual <= 1:
        return float(actual)
    errors.append(f"{path} must be a number between 0 and 1")
    return 0.0


def _join(prefix: str | None, key: str) -> str:
    return key if prefix is None else f"{prefix}.{key}"


def _raise_if_errors(errors: list[str]) -> None:
    if errors:
        raise ContractValidationError(errors)
