from __future__ import annotations

from pathlib import Path

import pytest

from firmcode_worker.context import (
    ContextBudgetError,
    SyntaxAwareChunkOptions,
    SyntaxAwareSourceFile,
    build_syntax_aware_context_artifact,
)
from firmcode_worker.tree_sitter.extractor import ChangedHunk


FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "context_chunking"


def test_context_chunks_stay_under_character_and_token_budgets() -> None:
    content = "\n".join(
        [
            "from decimal import Decimal",
            "",
            "",
            "def calculate_total(values: list[Decimal]) -> Decimal:",
            "    total = Decimal('0')",
            "    for value in values:",
            "        total += value",
            "    return total.quantize(Decimal('0.01'))",
        ]
    )
    artifact = build_syntax_aware_context_artifact(
        review_run_id="run-1",
        files=[
            SyntaxAwareSourceFile(
                path="src/pricing.py",
                content=content,
                changed_lines=(7,),
                hunks=(ChangedHunk(6, 2),),
                language="python",
            )
        ],
        tree_sitter_artifact={
            "files": [
                {
                    "path": "src/pricing.py",
                    "language": "python",
                    "symbols": [
                        {
                            "name": "calculate_total",
                            "kind": "function",
                            "range": {"startLine": 4, "endLine": 8},
                        }
                    ],
                    "imports": [{"source": "decimal", "symbols": ["Decimal"], "line": 1}],
                }
            ]
        },
        options=SyntaxAwareChunkOptions(max_chars=260, max_tokens=260, token_counter=len),
    )

    chunk = artifact["chunks"][0]

    assert chunk["charCount"] <= 260
    assert chunk["tokenCount"] <= 260
    assert "*   7 |         total += value" in chunk["text"]
    assert chunk["enclosingSymbol"]["name"] == "calculate_total"


def test_large_file_fixture_keeps_changed_lines_without_packing_the_whole_scope() -> None:
    source = (FIXTURE_DIR / "large_file.py").read_text()
    source = source + "\n".join(f"    total += {index}" for index in range(1, 900)) + "\n    return total\n"
    artifact = build_syntax_aware_context_artifact(
        review_run_id="run-1",
        files=[
            SyntaxAwareSourceFile(
                path="src/large_file.py",
                content=source,
                changed_lines=(450,),
                hunks=(ChangedHunk(449, 3),),
                language="python",
            )
        ],
        tree_sitter_artifact={
            "files": [
                {
                    "path": "src/large_file.py",
                    "language": "python",
                    "symbols": [
                        {"name": "large_handler", "kind": "function", "range": {"startLine": 4, "endLine": 904}}
                    ],
                    "imports": [{"source": "os", "symbols": ["os"], "line": 1}],
                }
            ]
        },
        options=SyntaxAwareChunkOptions(max_chars=700, context_lines=2),
    )

    chunk = artifact["chunks"][0]

    assert chunk["charCount"] <= 700
    assert "* 450 |     total += 445" in chunk["text"]
    assert "Scope: function large_handler L4-L904" in chunk["text"]
    assert " 250 |" not in chunk["text"]
    assert chunk["truncated"] is True


def test_nested_function_fixture_uses_innermost_scope_and_includes_imports() -> None:
    source = (FIXTURE_DIR / "nested_functions.py").read_text()
    artifact = build_syntax_aware_context_artifact(
        review_run_id="run-1",
        files=[
            SyntaxAwareSourceFile(
                path="src/nested_functions.py",
                content=source,
                changed_lines=(8,),
                hunks=(ChangedHunk(7, 2),),
                language="python",
            )
        ],
        tree_sitter_artifact={
            "files": [
                {
                    "path": "src/nested_functions.py",
                    "language": "python",
                    "symbols": [
                        {"name": "outer", "kind": "function", "range": {"startLine": 4, "endLine": 11}},
                        {"name": "inner", "kind": "function", "range": {"startLine": 7, "endLine": 9}},
                    ],
                    "imports": [{"source": "typing", "symbols": ["Iterable"], "line": 1}],
                }
            ]
        },
        options=SyntaxAwareChunkOptions(max_chars=900),
    )

    chunk = artifact["chunks"][0]

    assert chunk["enclosingSymbol"]["name"] == "inner"
    assert chunk["imports"] == [{"source": "typing", "symbols": ["Iterable"], "line": 1}]
    assert "Imports: typing (Iterable)" in chunk["text"]
    assert "*   8 |         normalized = value * factor" in chunk["text"]


def test_context_chunker_reports_impossible_budget_for_changed_lines() -> None:
    with pytest.raises(ContextBudgetError):
        build_syntax_aware_context_artifact(
            review_run_id="run-1",
            files=[
                SyntaxAwareSourceFile(
                    path="src/tiny.py",
                    content="def tiny():\n    return 'a very long changed line'\n",
                    changed_lines=(2,),
                    hunks=(ChangedHunk(2, 1),),
                    language="python",
                )
            ],
            tree_sitter_artifact={"files": []},
            options=SyntaxAwareChunkOptions(max_chars=20),
        )
