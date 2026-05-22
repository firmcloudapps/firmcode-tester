from __future__ import annotations

from pathlib import Path

import pytest

from firmcode_worker.semgrep.workspace import (
    ChangedFileScanInput,
    SemgrepScanWorkspaceConfig,
    SemgrepScanWorkspaceError,
    create_changed_file_scan_workspace,
)


def test_changed_file_scan_workspace_preserves_repo_paths_and_skips_ineligible_files(tmp_path: Path) -> None:
    config = SemgrepScanWorkspaceConfig(temp_dir=tmp_path / "semgrep-temp")
    changed_files = [
        ChangedFileScanInput(path="src/app.py", content="print('ok')\n", language="python"),
        ChangedFileScanInput(path="infra/service/config.yaml", content="apiVersion: v1\n", language="yaml"),
        ChangedFileScanInput(path="src/removed.py", content="", status="deleted", language="python"),
        ChangedFileScanInput(path="README.md", content="# docs\n", language=None),
    ]

    with create_changed_file_scan_workspace(changed_files=changed_files, config=config) as workspace:
        workspace_root = workspace.root

        assert workspace.root.parent == config.temp_dir
        assert workspace.targets == ("src/app.py", "infra/service/config.yaml")
        assert (workspace.root / "src" / "app.py").read_text() == "print('ok')\n"
        assert (workspace.root / "infra" / "service" / "config.yaml").read_text() == "apiVersion: v1\n"
        assert not (workspace.root / "src" / "removed.py").exists()
        assert not (workspace.root / "README.md").exists()
        assert [(file.path, file.reason) for file in workspace.skipped_files] == [
            ("src/removed.py", "deleted"),
            ("README.md", "unsupported"),
        ]

    assert not workspace_root.exists()


def test_changed_file_scan_workspace_cleans_up_after_failure(tmp_path: Path) -> None:
    config = SemgrepScanWorkspaceConfig(temp_dir=tmp_path / "semgrep-temp")
    workspace_root: Path | None = None

    with pytest.raises(RuntimeError, match="scan failed"):
        with create_changed_file_scan_workspace(
            changed_files=[ChangedFileScanInput(path="src/app.py", content="print('ok')\n", language="python")],
            config=config,
        ) as workspace:
            workspace_root = workspace.root
            assert workspace_root.exists()
            raise RuntimeError("scan failed")

    assert workspace_root is not None
    assert not workspace_root.exists()


@pytest.mark.parametrize(
    "unsafe_path",
    [
        "../secrets.py",
        "src/../../secrets.py",
        "/absolute/path.py",
        "src\\windows.py",
        "",
        ".",
    ],
)
def test_changed_file_scan_workspace_rejects_path_traversal(tmp_path: Path, unsafe_path: str) -> None:
    config = SemgrepScanWorkspaceConfig(temp_dir=tmp_path / "semgrep-temp")

    with pytest.raises(SemgrepScanWorkspaceError):
        with create_changed_file_scan_workspace(
            changed_files=[ChangedFileScanInput(path=unsafe_path, content="print('nope')\n", language="python")],
            config=config,
        ):
            pass
