from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from firmcode_worker.tree_sitter import (
    PARSER_LOAD_STATUS_AVAILABLE,
    PARSER_LOAD_STATUS_FAILED,
    PARSER_LOAD_STATUS_UNSUPPORTED,
    TreeSitterLanguageRegistry,
    TreeSitterParserRegistry,
)


@pytest.mark.parametrize(
    ("path", "language", "parser_package", "language_symbol"),
    [
        ("src/app.js", "javascript", "tree_sitter_javascript", "language"),
        ("src/component.jsx", "javascript", "tree_sitter_javascript", "language"),
        ("src/app.ts", "typescript", "tree_sitter_typescript", "language_typescript"),
        ("src/component.tsx", "typescript", "tree_sitter_typescript", "language_tsx"),
        ("src/app.py", "python", "tree_sitter_python", "language"),
        ("src/main.go", "go", "tree_sitter_go", "language"),
        ("src/App.java", "java", "tree_sitter_java", "language"),
        ("config/service.yaml", "yaml", "tree_sitter_yaml", "language"),
        ("config/service.yml", "yaml", "tree_sitter_yaml", "language"),
        ("package.json", "json", "tree_sitter_json", "language"),
        ("Dockerfile", "dockerfile", "tree_sitter_dockerfile", "language"),
        ("infra/docker/api.Dockerfile", "dockerfile", "tree_sitter_dockerfile", "language"),
        ("infra/main.tf", "terraform", "tree_sitter_hcl", "language"),
        ("infra/vars.tfvars", "terraform", "tree_sitter_hcl", "language"),
        ("infra/policy.hcl", "hcl", "tree_sitter_hcl", "language"),
    ],
)
def test_language_registry_maps_mvp_paths(
    path: str,
    language: str,
    parser_package: str,
    language_symbol: str,
) -> None:
    resolution = TreeSitterLanguageRegistry().resolve_path(path)

    assert resolution.status == PARSER_LOAD_STATUS_AVAILABLE
    assert resolution.language == language
    assert resolution.parser_package == parser_package
    assert resolution.language_symbol == language_symbol


@pytest.mark.parametrize("path", ["README.md", "src/archive.zip", "../escape.py", "/tmp/app.py", "src\\app.py"])
def test_language_registry_returns_explicit_unsupported_status(path: str) -> None:
    resolution = TreeSitterLanguageRegistry().resolve_path(path)

    assert resolution.status == PARSER_LOAD_STATUS_UNSUPPORTED
    assert resolution.supported is False
    assert resolution.reason in {"unsupported_extension", "invalid_path"}


def test_language_registry_resolves_language_aliases() -> None:
    registry = TreeSitterLanguageRegistry()

    assert registry.resolve_language("TypeScript").language == "typescript"
    assert registry.resolve_language("typescriptreact").language == "typescript"
    assert registry.resolve_language("golang").language == "go"
    assert registry.resolve_language("terraform").language == "terraform"
    assert registry.resolve_language("not-a-language").status == PARSER_LOAD_STATUS_UNSUPPORTED


def test_parser_registry_loads_available_parser_with_injected_modules() -> None:
    registry = TreeSitterParserRegistry(module_loader=_fake_successful_module_loader)

    loaded = registry.load_for_path("src/app.py")

    assert loaded.status == PARSER_LOAD_STATUS_AVAILABLE
    assert loaded.available is True
    assert loaded.language == "python"
    assert loaded.parser_name == "tree-sitter-python"
    assert loaded.parser.language.name == "python-grammar"
    assert registry.load_for_path("src/another.py") is loaded


def test_parser_registry_returns_unsupported_without_importing_modules() -> None:
    calls: list[str] = []

    def loader(name: str) -> Any:
        calls.append(name)
        raise AssertionError("unsupported paths should not import parser packages")

    loaded = TreeSitterParserRegistry(module_loader=loader).load_for_path("README.md")

    assert loaded.status == PARSER_LOAD_STATUS_UNSUPPORTED
    assert loaded.available is False
    assert loaded.error == "unsupported_extension"
    assert calls == []


def test_parser_registry_returns_failed_status_for_parser_load_errors() -> None:
    loaded = TreeSitterParserRegistry(module_loader=_fake_failing_module_loader).load_for_path("src/app.py")

    assert loaded.status == PARSER_LOAD_STATUS_FAILED
    assert loaded.available is False
    assert loaded.language == "python"
    assert loaded.parser is None
    assert loaded.error is not None
    assert "ModuleNotFoundError" in loaded.error
    assert "tree_sitter_python" in loaded.error


class _FakeLanguage:
    def __init__(self, raw_language: Any) -> None:
        self.name = raw_language


class _FakeParser:
    def __init__(self) -> None:
        self.language: _FakeLanguage | None = None

    def set_language(self, language: _FakeLanguage) -> None:
        self.language = language


def _fake_successful_module_loader(name: str) -> Any:
    if name == "tree_sitter":
        return SimpleNamespace(Language=_FakeLanguage, Parser=_FakeParser)
    if name == "tree_sitter_python":
        return SimpleNamespace(language=lambda: "python-grammar")
    raise ModuleNotFoundError(name)


def _fake_failing_module_loader(name: str) -> Any:
    if name == "tree_sitter":
        return SimpleNamespace(Language=_FakeLanguage, Parser=_FakeParser)
    raise ModuleNotFoundError(name)
