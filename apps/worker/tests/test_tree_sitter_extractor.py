from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

from firmcode_worker.schemas.contracts import TreeSitterArtifact
from firmcode_worker.tree_sitter.extractor import (
    PARSE_STATUS_PARTIAL,
    ChangedHunk,
    SemanticExtractionFile,
    extract_file_semantics,
    extract_tree_sitter_artifact,
)


FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "tree_sitter"


def _has_tree_sitter_grammars() -> bool:
    return all(
        importlib.util.find_spec(module_name) is not None
        for module_name in [
            "tree_sitter",
            "tree_sitter_typescript",
            "tree_sitter_python",
            "tree_sitter_go",
            "tree_sitter_yaml",
        ]
    )


requires_tree_sitter_grammars = pytest.mark.skipif(
    not _has_tree_sitter_grammars(),
    reason="Tree-sitter runtime grammar packages are not installed",
)


@pytest.mark.parametrize(
    ("source_name", "expected_name", "path", "changed_lines", "hunks"),
    [
        ("typescript.ts", "typescript.expected.json", "src/review.ts", (10, 15), (ChangedHunk(9, 2), ChangedHunk(14, 2))),
        ("python.py", "python.expected.json", "src/runner.py", (11,), (ChangedHunk(10, 2),)),
        ("go.go", "go.expected.json", "src/review.go", (17,), (ChangedHunk(16, 2),)),
        ("workflow.yaml", "workflow.expected.json", ".github/workflows/review.yml", (8,), (ChangedHunk(7, 2),)),
    ],
)
@requires_tree_sitter_grammars
def test_semantic_extractor_matches_golden_fixtures(
    source_name: str,
    expected_name: str,
    path: str,
    changed_lines: tuple[int, ...],
    hunks: tuple[ChangedHunk, ...],
) -> None:
    source = (FIXTURE_DIR / source_name).read_text()
    expected = json.loads((FIXTURE_DIR / expected_name).read_text())

    artifact = extract_file_semantics(
        SemanticExtractionFile(path=path, content=source, changed_lines=changed_lines, hunks=hunks)
    )

    assert artifact["parseStatus"] == "parsed"
    assert artifact["hasError"] is False
    assert _stable_projection(artifact) == expected


@requires_tree_sitter_grammars
def test_tree_sitter_artifact_contract_accepts_extractor_output() -> None:
    artifact = extract_tree_sitter_artifact(
        review_run_id="run-1",
        files=[
            SemanticExtractionFile(
                path="src/review.ts",
                content=(FIXTURE_DIR / "typescript.ts").read_text(),
                changed_lines=(10,),
                hunks=(ChangedHunk(9, 2),),
            )
        ],
    )

    parsed = TreeSitterArtifact.from_mapping(artifact)

    assert parsed.review_run_id == "run-1"
    assert parsed.files[0].symbols[1].changed is True
    assert parsed.files[0].hunk_scopes[0].enclosing_symbol == "handle"


@requires_tree_sitter_grammars
def test_semantic_extractor_records_parse_errors_as_artifacts() -> None:
    artifact = extract_file_semantics(
        SemanticExtractionFile(
            path="src/broken.py",
            content="def broken(:\n    return 1\n",
            changed_lines=(1,),
            hunks=(ChangedHunk(1, 1),),
        )
    )

    assert artifact["parseStatus"] == PARSE_STATUS_PARTIAL
    assert artifact["hasError"] is True
    assert artifact["errors"]


def test_changed_hunk_scopes_choose_smallest_enclosing_symbol() -> None:
    artifact = {
        "symbols": [
            {"name": "ReviewController", "range": {"startLine": 8, "endLine": 12}},
            {"name": "handle", "range": {"startLine": 9, "endLine": 11}},
        ],
        "hunkScopes": [],
    }

    # The public extractor path exercises this in golden tests; this assertion keeps
    # the expected behavior readable without a parser dependency.
    from firmcode_worker.tree_sitter.extractor import _hunk_scopes

    scopes = _hunk_scopes("src/review.ts", [ChangedHunk(10, 1)], artifact["symbols"])

    assert scopes == [
        {
            "path": "src/review.ts",
            "hunkNewStart": 10,
            "hunkNewEnd": 10,
            "enclosingSymbol": "handle",
        }
    ]


def _stable_projection(artifact: dict[str, object]) -> dict[str, object]:
    return {
        "symbols": [
            {
                "name": symbol["name"],
                "kind": symbol["kind"],
                "range": symbol["range"],
                "changed": symbol["changed"],
            }
            for symbol in artifact["symbols"]
        ],
        "imports": artifact["imports"],
        "hunkScopes": artifact["hunkScopes"],
    }
