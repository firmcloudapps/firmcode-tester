from __future__ import annotations

import importlib
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Any


PARSER_LOAD_STATUS_AVAILABLE = "available"
PARSER_LOAD_STATUS_FAILED = "failed"
PARSER_LOAD_STATUS_UNSUPPORTED = "unsupported"
PARSER_LOAD_STATUSES = {
    PARSER_LOAD_STATUS_AVAILABLE,
    PARSER_LOAD_STATUS_FAILED,
    PARSER_LOAD_STATUS_UNSUPPORTED,
}


@dataclass(frozen=True)
class TreeSitterLanguageDefinition:
    language: str
    parser_package: str
    parser_name: str
    language_symbol: str
    extensions: tuple[str, ...] = ()
    filenames: tuple[str, ...] = ()
    language_aliases: tuple[str, ...] = ()

    @property
    def cache_key(self) -> tuple[str, str, str]:
        return (self.language, self.parser_package, self.language_symbol)


@dataclass(frozen=True)
class TreeSitterLanguageResolution:
    path: str | None
    language: str | None
    parser_package: str | None
    parser_name: str | None
    language_symbol: str | None
    status: str
    reason: str | None = None

    @property
    def supported(self) -> bool:
        return self.status != PARSER_LOAD_STATUS_UNSUPPORTED


@dataclass(frozen=True)
class TreeSitterParserLoadResult:
    language: str | None
    parser_package: str | None
    parser_name: str | None
    language_symbol: str | None
    status: str
    parser: Any | None = None
    language_object: Any | None = None
    error: str | None = None

    @property
    def available(self) -> bool:
        return self.status == PARSER_LOAD_STATUS_AVAILABLE


DEFAULT_LANGUAGE_DEFINITIONS: tuple[TreeSitterLanguageDefinition, ...] = (
    TreeSitterLanguageDefinition(
        language="javascript",
        parser_package="tree_sitter_javascript",
        parser_name="tree-sitter-javascript",
        language_symbol="language",
        extensions=(".js", ".jsx", ".mjs", ".cjs"),
        language_aliases=("js", "node", "javascriptreact"),
    ),
    TreeSitterLanguageDefinition(
        language="typescript",
        parser_package="tree_sitter_typescript",
        parser_name="tree-sitter-typescript",
        language_symbol="language_typescript",
        extensions=(".ts", ".mts", ".cts"),
        language_aliases=("ts",),
    ),
    TreeSitterLanguageDefinition(
        language="typescript",
        parser_package="tree_sitter_typescript",
        parser_name="tree-sitter-typescript",
        language_symbol="language_tsx",
        extensions=(".tsx",),
        language_aliases=("tsx", "typescriptreact"),
    ),
    TreeSitterLanguageDefinition(
        language="python",
        parser_package="tree_sitter_python",
        parser_name="tree-sitter-python",
        language_symbol="language",
        extensions=(".py", ".pyi"),
        language_aliases=("py",),
    ),
    TreeSitterLanguageDefinition(
        language="go",
        parser_package="tree_sitter_go",
        parser_name="tree-sitter-go",
        language_symbol="language",
        extensions=(".go",),
        language_aliases=("golang",),
    ),
    TreeSitterLanguageDefinition(
        language="java",
        parser_package="tree_sitter_java",
        parser_name="tree-sitter-java",
        language_symbol="language",
        extensions=(".java",),
    ),
    TreeSitterLanguageDefinition(
        language="yaml",
        parser_package="tree_sitter_yaml",
        parser_name="tree-sitter-yaml",
        language_symbol="language",
        extensions=(".yaml", ".yml"),
        language_aliases=("yml",),
    ),
    TreeSitterLanguageDefinition(
        language="json",
        parser_package="tree_sitter_json",
        parser_name="tree-sitter-json",
        language_symbol="language",
        extensions=(".json", ".jsonc"),
    ),
    TreeSitterLanguageDefinition(
        language="dockerfile",
        parser_package="tree_sitter_dockerfile",
        parser_name="tree-sitter-dockerfile",
        language_symbol="language",
        extensions=(".dockerfile",),
        filenames=("dockerfile", "containerfile"),
    ),
    TreeSitterLanguageDefinition(
        language="terraform",
        parser_package="tree_sitter_hcl",
        parser_name="tree-sitter-hcl",
        language_symbol="language",
        extensions=(".tf", ".tfvars"),
        language_aliases=("tf",),
    ),
    TreeSitterLanguageDefinition(
        language="hcl",
        parser_package="tree_sitter_hcl",
        parser_name="tree-sitter-hcl",
        language_symbol="language",
        extensions=(".hcl",),
    ),
)


class TreeSitterLanguageRegistry:
    def __init__(self, definitions: Sequence[TreeSitterLanguageDefinition] = DEFAULT_LANGUAGE_DEFINITIONS) -> None:
        self._definitions = tuple(definitions)
        self._extensions = _build_extension_map(self._definitions)
        self._filenames = _build_filename_map(self._definitions)
        self._language_aliases = _build_language_alias_map(self._definitions)

    @property
    def supported_languages(self) -> tuple[str, ...]:
        return tuple(sorted({definition.language for definition in self._definitions}))

    def resolve_path(self, path: str) -> TreeSitterLanguageResolution:
        normalized_path = _normalize_repository_path(path)
        if normalized_path is None:
            return _unsupported(path=path, reason="invalid_path")

        filename = PurePosixPath(normalized_path).name.lower()
        definition = self._filenames.get(filename)
        if definition is None and filename.startswith("dockerfile."):
            definition = self._language_aliases.get("dockerfile")
        if definition is None:
            definition = self._extensions.get(PurePosixPath(normalized_path).suffix.lower())

        if definition is None:
            return _unsupported(path=normalized_path, reason="unsupported_extension")

        return _resolution(path=normalized_path, definition=definition)

    def resolve_language(self, language: str | None) -> TreeSitterLanguageResolution:
        normalized_language = _normalize_language(language)
        if normalized_language is None:
            return _unsupported(path=None, reason="missing_language")

        definition = self._language_aliases.get(normalized_language)
        if definition is None:
            return _unsupported(path=None, reason="unsupported_language")

        return _resolution(path=None, definition=definition)


class TreeSitterParserRegistry:
    def __init__(
        self,
        language_registry: TreeSitterLanguageRegistry | None = None,
        *,
        module_loader: Callable[[str], Any] = importlib.import_module,
    ) -> None:
        self._language_registry = language_registry or TreeSitterLanguageRegistry()
        self._module_loader = module_loader
        self._cache: dict[tuple[str, str, str], TreeSitterParserLoadResult] = {}

    @property
    def language_registry(self) -> TreeSitterLanguageRegistry:
        return self._language_registry

    def load_for_path(self, path: str) -> TreeSitterParserLoadResult:
        return self.load_for_resolution(self._language_registry.resolve_path(path))

    def load_for_language(self, language: str | None) -> TreeSitterParserLoadResult:
        return self.load_for_resolution(self._language_registry.resolve_language(language))

    def load_for_resolution(self, resolution: TreeSitterLanguageResolution) -> TreeSitterParserLoadResult:
        if not resolution.supported:
            return TreeSitterParserLoadResult(
                language=resolution.language,
                parser_package=resolution.parser_package,
                parser_name=resolution.parser_name,
                language_symbol=resolution.language_symbol,
                status=PARSER_LOAD_STATUS_UNSUPPORTED,
                error=resolution.reason,
            )

        cache_key = (resolution.language or "", resolution.parser_package or "", resolution.language_symbol or "")
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        result = self._load_parser(resolution)
        self._cache[cache_key] = result
        return result

    def _load_parser(self, resolution: TreeSitterLanguageResolution) -> TreeSitterParserLoadResult:
        assert resolution.language is not None
        assert resolution.parser_package is not None
        assert resolution.parser_name is not None
        assert resolution.language_symbol is not None

        try:
            tree_sitter_module = self._module_loader("tree_sitter")
            grammar_module = self._module_loader(resolution.parser_package)
            raw_language_factory = getattr(grammar_module, resolution.language_symbol)
            language_object = _coerce_language(tree_sitter_module, raw_language_factory())
            parser = _build_parser(tree_sitter_module, language_object)
            return TreeSitterParserLoadResult(
                language=resolution.language,
                parser_package=resolution.parser_package,
                parser_name=resolution.parser_name,
                language_symbol=resolution.language_symbol,
                status=PARSER_LOAD_STATUS_AVAILABLE,
                parser=parser,
                language_object=language_object,
            )
        except Exception as error:
            return TreeSitterParserLoadResult(
                language=resolution.language,
                parser_package=resolution.parser_package,
                parser_name=resolution.parser_name,
                language_symbol=resolution.language_symbol,
                status=PARSER_LOAD_STATUS_FAILED,
                error=f"{error.__class__.__name__}: {error}",
            )


def _resolution(path: str | None, definition: TreeSitterLanguageDefinition) -> TreeSitterLanguageResolution:
    return TreeSitterLanguageResolution(
        path=path,
        language=definition.language,
        parser_package=definition.parser_package,
        parser_name=definition.parser_name,
        language_symbol=definition.language_symbol,
        status=PARSER_LOAD_STATUS_AVAILABLE,
    )


def _unsupported(path: str | None, reason: str) -> TreeSitterLanguageResolution:
    return TreeSitterLanguageResolution(
        path=path,
        language=None,
        parser_package=None,
        parser_name=None,
        language_symbol=None,
        status=PARSER_LOAD_STATUS_UNSUPPORTED,
        reason=reason,
    )


def _build_extension_map(
    definitions: Sequence[TreeSitterLanguageDefinition],
) -> Mapping[str, TreeSitterLanguageDefinition]:
    return {
        extension.lower(): definition
        for definition in definitions
        for extension in definition.extensions
    }


def _build_filename_map(
    definitions: Sequence[TreeSitterLanguageDefinition],
) -> Mapping[str, TreeSitterLanguageDefinition]:
    return {
        filename.lower(): definition
        for definition in definitions
        for filename in definition.filenames
    }


def _build_language_alias_map(
    definitions: Sequence[TreeSitterLanguageDefinition],
) -> Mapping[str, TreeSitterLanguageDefinition]:
    aliases: dict[str, TreeSitterLanguageDefinition] = {}
    for definition in definitions:
        aliases.setdefault(definition.language.lower(), definition)
        for alias in definition.language_aliases:
            aliases[alias.lower()] = definition
    return aliases


def _normalize_repository_path(path: str) -> str | None:
    if "\x00" in path or "\\" in path:
        return None

    raw_path = path.strip()
    pure_path = PurePosixPath(raw_path)
    if raw_path == "" or pure_path.is_absolute():
        return None
    if any(part in {"", ".", ".."} for part in raw_path.split("/")):
        return None

    return pure_path.as_posix()


def _normalize_language(language: str | None) -> str | None:
    if language is None:
        return None
    normalized = language.strip().lower().replace("-", "_").replace(" ", "_")
    return normalized or None


def _coerce_language(tree_sitter_module: Any, raw_language: Any) -> Any:
    language_type = getattr(tree_sitter_module, "Language")
    if isinstance(raw_language, language_type):
        return raw_language
    return language_type(raw_language)


def _build_parser(tree_sitter_module: Any, language_object: Any) -> Any:
    parser = tree_sitter_module.Parser()
    set_language = getattr(parser, "set_language", None)
    if callable(set_language):
        set_language(language_object)
    else:
        parser.language = language_object
    return parser
