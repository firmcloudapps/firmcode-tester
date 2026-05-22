from __future__ import annotations

import os
import shutil
import tempfile
from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


DEFAULT_SEMGREP_SCAN_TEMP_DIR = "firmcode-semgrep"
SUPPORTED_SEMGREP_LANGUAGES = frozenset(
    {
        "dockerfile",
        "go",
        "hcl",
        "java",
        "javascript",
        "json",
        "python",
        "terraform",
        "typescript",
        "yaml",
    }
)
DELETED_FILE_STATUSES = frozenset({"deleted", "removed"})


class SemgrepScanWorkspaceError(ValueError):
    pass


@dataclass(frozen=True)
class SemgrepScanWorkspaceConfig:
    temp_dir: Path

    @classmethod
    def from_env(cls, env: Mapping[str, str] = os.environ) -> "SemgrepScanWorkspaceConfig":
        configured_dir = env.get("SEMGREP_SCAN_TEMP_DIR", "").strip()
        temp_dir = Path(configured_dir) if configured_dir else Path(tempfile.gettempdir()) / DEFAULT_SEMGREP_SCAN_TEMP_DIR
        return cls(temp_dir=temp_dir)


@dataclass(frozen=True)
class ChangedFileScanInput:
    path: str
    content: str
    status: str = "modified"
    language: str | None = None


@dataclass(frozen=True)
class SemgrepWorkspaceSkippedFile:
    path: str
    reason: str
    detail: str


@dataclass(frozen=True)
class SemgrepScanWorkspace:
    root: Path
    targets: tuple[str, ...]
    skipped_files: tuple[SemgrepWorkspaceSkippedFile, ...]


@contextmanager
def create_changed_file_scan_workspace(
    *,
    changed_files: Sequence[ChangedFileScanInput],
    config: SemgrepScanWorkspaceConfig | None = None,
) -> Iterator[SemgrepScanWorkspace]:
    workspace_config = config or SemgrepScanWorkspaceConfig.from_env()
    base_temp_dir = _prepare_base_temp_dir(workspace_config.temp_dir)
    workspace_root = Path(tempfile.mkdtemp(prefix="scan-", dir=base_temp_dir))
    _assert_path_within(workspace_root.resolve(), base_temp_dir, "scan workspace")

    try:
        workspace = _populate_workspace(workspace_root=workspace_root, changed_files=changed_files)
        yield workspace
    finally:
        shutil.rmtree(workspace_root, ignore_errors=True)


def _prepare_base_temp_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def _populate_workspace(
    *,
    workspace_root: Path,
    changed_files: Sequence[ChangedFileScanInput],
) -> SemgrepScanWorkspace:
    targets: list[str] = []
    skipped_files: list[SemgrepWorkspaceSkippedFile] = []
    seen_paths: set[str] = set()

    for changed_file in changed_files:
        repo_path = _validate_repository_relative_path(changed_file.path)

        if repo_path in seen_paths:
            skipped_files.append(
                SemgrepWorkspaceSkippedFile(
                    path=repo_path,
                    reason="duplicate_path",
                    detail="Duplicate changed-file path was not copied into the scan workspace.",
                )
            )
            continue
        seen_paths.add(repo_path)

        skip_reason = _skip_reason(changed_file)
        if skip_reason is not None:
            skipped_files.append(SemgrepWorkspaceSkippedFile(path=repo_path, reason=skip_reason[0], detail=skip_reason[1]))
            continue

        target_path = workspace_root / repo_path
        _assert_path_within(target_path.resolve(), workspace_root.resolve(), "changed file")
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_text(changed_file.content, encoding="utf-8")
        targets.append(repo_path)

    return SemgrepScanWorkspace(root=workspace_root, targets=tuple(targets), skipped_files=tuple(skipped_files))


def _skip_reason(changed_file: ChangedFileScanInput) -> tuple[str, str] | None:
    if changed_file.status.lower() in DELETED_FILE_STATUSES:
        return ("deleted", "Deleted files do not have head content to scan.")
    if changed_file.language is None or changed_file.language.lower() not in SUPPORTED_SEMGREP_LANGUAGES:
        return ("unsupported", "File language is not enabled for Semgrep changed-file scans.")
    return None


def _validate_repository_relative_path(path: str) -> str:
    if "\x00" in path:
        raise SemgrepScanWorkspaceError("Changed-file path cannot contain NUL bytes.")
    if "\\" in path:
        raise SemgrepScanWorkspaceError("Changed-file path must use repository-relative POSIX separators.")

    raw_parts = path.split("/")
    pure_path = PurePosixPath(path)
    if path.strip() == "" or pure_path.is_absolute():
        raise SemgrepScanWorkspaceError("Changed-file path must be repository-relative.")
    if any(part in {"", ".", ".."} for part in raw_parts):
        raise SemgrepScanWorkspaceError("Changed-file path cannot contain empty, current, or parent segments.")

    return pure_path.as_posix()


def _assert_path_within(path: Path, root: Path, label: str) -> None:
    try:
        path.relative_to(root)
    except ValueError as error:
        raise SemgrepScanWorkspaceError(f"{label} cannot escape configured temp directory.") from error
