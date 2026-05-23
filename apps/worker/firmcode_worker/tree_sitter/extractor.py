from __future__ import annotations

import importlib.metadata
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from firmcode_worker.schemas.contracts import TREE_SITTER_ARTIFACT_SCHEMA_VERSION
from firmcode_worker.tree_sitter.registry import (
    PARSER_LOAD_STATUS_FAILED,
    PARSER_LOAD_STATUS_UNSUPPORTED,
    TreeSitterParserRegistry,
)


PARSE_STATUS_PARSED = "parsed"
PARSE_STATUS_PARTIAL = "partial"
PARSE_STATUS_FAILED = "failed"
PARSE_STATUS_UNSUPPORTED = "unsupported"

@dataclass(frozen=True)
class ChangedHunk:
    new_start: int
    new_line_count: int

    @property
    def new_end(self) -> int:
        return max(self.new_start, self.new_start + self.new_line_count - 1)


@dataclass(frozen=True)
class SemanticExtractionFile:
    path: str
    content: str
    changed_lines: tuple[int, ...] = ()
    hunks: tuple[ChangedHunk, ...] = ()


def extract_tree_sitter_artifact(
    *,
    review_run_id: str,
    files: Sequence[SemanticExtractionFile],
    parser_registry: TreeSitterParserRegistry | None = None,
) -> dict[str, Any]:
    registry = parser_registry or TreeSitterParserRegistry()
    return {
        "schemaVersion": TREE_SITTER_ARTIFACT_SCHEMA_VERSION,
        "reviewRunId": review_run_id,
        "parserVersion": _package_version("tree-sitter"),
        "files": [extract_file_semantics(file, registry) for file in files],
    }


def extract_file_semantics(
    file: SemanticExtractionFile,
    parser_registry: TreeSitterParserRegistry | None = None,
) -> dict[str, Any]:
    registry = parser_registry or TreeSitterParserRegistry()
    loaded = registry.load_for_path(file.path)

    if loaded.status == PARSER_LOAD_STATUS_UNSUPPORTED:
        return _unparsed_file_artifact(file=file, loaded=loaded, parse_status=PARSE_STATUS_UNSUPPORTED)

    if loaded.status == PARSER_LOAD_STATUS_FAILED or loaded.parser is None:
        return _unparsed_file_artifact(file=file, loaded=loaded, parse_status=PARSE_STATUS_FAILED)

    source_bytes = file.content.encode("utf-8")
    try:
        tree = loaded.parser.parse(source_bytes)
        root = tree.root_node
    except Exception as error:
        return _unparsed_file_artifact(
            file=file,
            loaded=loaded,
            parse_status=PARSE_STATUS_FAILED,
            errors=[f"{error.__class__.__name__}: {error}"],
        )

    symbols = _extract_symbols(language=loaded.language or "", root=root, source_bytes=source_bytes)
    changed_line_set = set(file.changed_lines)
    normalized_symbols = [_symbol_to_artifact(symbol, changed_line_set) for symbol in symbols]
    imports = _extract_imports(language=loaded.language or "", root=root, source_bytes=source_bytes)
    hunk_scopes = _hunk_scopes(file.path, file.hunks, normalized_symbols)
    error_node_count = _count_all_nodes(root, lambda node: _node_type(node) == "ERROR")
    missing_node_count = _count_all_nodes(root, _node_is_missing)
    has_error = _node_has_error(root) or error_node_count > 0 or missing_node_count > 0

    errors: list[str] = []
    if has_error and not error_node_count and not missing_node_count:
        errors.append("parse_error")
    if error_node_count:
        errors.append(f"parse_error_nodes:{error_node_count}")
    if missing_node_count:
        errors.append(f"missing_nodes:{missing_node_count}")

    return {
        "path": file.path,
        "language": loaded.language or "unknown",
        "parser": loaded.parser_name or "unknown",
        "parseStatus": PARSE_STATUS_PARTIAL if has_error else PARSE_STATUS_PARSED,
        "hasError": has_error,
        "missingNodeCount": missing_node_count,
        "errorNodeCount": error_node_count,
        "symbols": normalized_symbols,
        "imports": imports,
        "hunkScopes": hunk_scopes,
        "errors": errors,
    }


@dataclass(frozen=True)
class _Symbol:
    name: str
    kind: str
    node: Any


def _unparsed_file_artifact(
    *,
    file: SemanticExtractionFile,
    loaded: Any,
    parse_status: str,
    errors: list[str] | None = None,
) -> dict[str, Any]:
    detail = errors or ([loaded.error] if loaded.error else [])
    return {
        "path": file.path,
        "language": loaded.language or "unknown",
        "parser": loaded.parser_name or "unknown",
        "parseStatus": parse_status,
        "hasError": parse_status != PARSE_STATUS_UNSUPPORTED,
        "missingNodeCount": 0,
        "errorNodeCount": 0,
        "symbols": [],
        "imports": [],
        "hunkScopes": _hunk_scopes(file.path, file.hunks, []),
        "errors": [error for error in detail if error],
    }


def _extract_symbols(*, language: str, root: Any, source_bytes: bytes) -> list[_Symbol]:
    symbols: list[_Symbol] = []

    for node in _walk_named(root):
        node_type = _node_type(node)
        symbol = None
        if language in {"typescript", "javascript"}:
            symbol = _typescript_symbol(node, node_type, source_bytes)
        elif language == "python":
            symbol = _python_symbol(node, node_type, source_bytes)
        elif language == "go":
            symbol = _go_symbol(node, node_type, source_bytes)
        elif language == "yaml":
            symbol = _yaml_symbol(node, node_type, source_bytes)

        if symbol is not None:
            symbols.append(symbol)

    return _dedupe_symbols(symbols)


def _typescript_symbol(node: Any, node_type: str, source_bytes: bytes) -> _Symbol | None:
    if node_type in {"class_declaration", "abstract_class_declaration"}:
        return _named_symbol(node, "class", source_bytes)
    if node_type in {"function_declaration", "generator_function_declaration"}:
        return _named_symbol(node, "function", source_bytes)
    if node_type in {"method_definition", "method_signature", "abstract_method_signature"}:
        return _named_symbol(node, "method", source_bytes)
    if node_type in {"lexical_declaration", "variable_declaration"}:
        return _typescript_variable_function_symbol(node, source_bytes)
    return None


def _typescript_variable_function_symbol(node: Any, source_bytes: bytes) -> _Symbol | None:
    for child in _named_children(node):
        if _node_type(child) != "variable_declarator":
            continue
        value = _child_by_field_name(child, "value")
        if value is None or _node_type(value) not in {"arrow_function", "function"}:
            continue
        name = _text(_child_by_field_name(child, "name"), source_bytes)
        if name:
            return _Symbol(name=name, kind="function", node=child)
    return None


def _python_symbol(node: Any, node_type: str, source_bytes: bytes) -> _Symbol | None:
    if node_type == "class_definition":
        return _named_symbol(node, "class", source_bytes)
    if node_type == "function_definition":
        return _named_symbol(node, "method" if _has_ancestor_type(node, "class_definition") else "function", source_bytes)
    return None


def _go_symbol(node: Any, node_type: str, source_bytes: bytes) -> _Symbol | None:
    if node_type == "function_declaration":
        return _named_symbol(node, "function", source_bytes)
    if node_type == "method_declaration":
        return _named_symbol(node, "method", source_bytes)
    if node_type == "type_spec":
        type_node = _first_child_of_type(node, {"struct_type", "interface_type"})
        if type_node is not None:
            return _named_symbol(node, "class", source_bytes)
    return None


def _yaml_symbol(node: Any, node_type: str, source_bytes: bytes) -> _Symbol | None:
    if node_type not in {"block_mapping_pair", "flow_pair"}:
        return None
    key = _child_by_field_name(node, "key") or (_named_children(node)[0] if _named_children(node) else None)
    name = _clean_scalar(_text(key, source_bytes))
    if name:
        return _Symbol(name=name, kind="mapping", node=node)
    return None


def _named_symbol(node: Any, kind: str, source_bytes: bytes) -> _Symbol | None:
    name = _text(_child_by_field_name(node, "name"), source_bytes)
    if name:
        return _Symbol(name=name, kind=kind, node=node)
    return None


def _dedupe_symbols(symbols: Iterable[_Symbol]) -> list[_Symbol]:
    deduped: dict[tuple[str, str, int, int], _Symbol] = {}
    for symbol in symbols:
        key = (symbol.kind, symbol.name, _node_start_line(symbol.node), _node_end_line(symbol.node))
        deduped.setdefault(key, symbol)
    return sorted(deduped.values(), key=lambda item: (_node_start_line(item.node), _node_end_line(item.node), item.kind, item.name))


def _symbol_to_artifact(symbol: _Symbol, changed_lines: set[int]) -> dict[str, Any]:
    start_line = _node_start_line(symbol.node)
    end_line = _node_end_line(symbol.node)
    return {
        "name": symbol.name,
        "kind": symbol.kind,
        "range": {"startLine": start_line, "endLine": end_line},
        "byteRange": {"startByte": _node_start_byte(symbol.node), "endByte": _node_end_byte(symbol.node)},
        "changed": bool(changed_lines.intersection(range(start_line, end_line + 1))),
    }


def _extract_imports(*, language: str, root: Any, source_bytes: bytes) -> list[dict[str, Any]]:
    imports: list[dict[str, Any]] = []
    for node in _walk_named(root):
        node_type = _node_type(node)
        if language in {"typescript", "javascript"} and node_type == "import_statement":
            imports.append(_typescript_import(node, source_bytes))
        elif language == "python" and node_type in {"import_statement", "import_from_statement"}:
            imports.append(_python_import(node, source_bytes))
        elif language == "go" and node_type == "import_spec":
            imports.append(_go_import(node, source_bytes))

    return [item for item in imports if item["source"]]


def _typescript_import(node: Any, source_bytes: bytes) -> dict[str, Any]:
    source = _strip_quotes(_text(_child_by_field_name(node, "source"), source_bytes))
    symbols = [
        _text(child, source_bytes)
        for child in _walk_named(node)
        if _node_type(child) in {"identifier", "property_identifier"} and child is not _child_by_field_name(node, "source")
    ]
    return {"source": source or _text(node, source_bytes), "symbols": _dedupe_strings(symbols), "line": _node_start_line(node)}


def _python_import(node: Any, source_bytes: bytes) -> dict[str, Any]:
    text = _text(node, source_bytes)
    symbols: list[str] = []
    source = ""
    if _node_type(node) == "import_from_statement":
        module = _child_by_field_name(node, "module_name") or _child_by_field_name(node, "module")
        source = _text(module, source_bytes)
        symbols = [
            _text(child, source_bytes)
            for child in _walk_named(node)
            if _node_type(child) in {"identifier", "dotted_name"} and _text(child, source_bytes) != source
        ]
    else:
        symbols = [_text(child, source_bytes) for child in _walk_named(node) if _node_type(child) in {"identifier", "dotted_name"}]
        source = symbols[0] if symbols else text.replace("import", "", 1).strip().split(",")[0].strip()
    return {"source": source or text, "symbols": _dedupe_strings(symbols), "line": _node_start_line(node)}


def _go_import(node: Any, source_bytes: bytes) -> dict[str, Any]:
    path = _child_by_field_name(node, "path")
    source = _strip_quotes(_text(path, source_bytes)) or _strip_quotes(_text(node, source_bytes))
    name_node = _child_by_field_name(node, "name")
    name = _text(name_node, source_bytes)
    return {"source": source, "symbols": [name] if name and name not in {".", "_"} else [], "line": _node_start_line(node)}


def _hunk_scopes(path: str, hunks: Sequence[ChangedHunk], symbols: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "path": path,
            "hunkNewStart": hunk.new_start,
            "hunkNewEnd": hunk.new_end,
            "enclosingSymbol": _enclosing_symbol(hunk, symbols),
        }
        for hunk in hunks
    ]


def _enclosing_symbol(hunk: ChangedHunk, symbols: Sequence[Mapping[str, Any]]) -> str | None:
    fully_containing: list[Mapping[str, Any]] = []
    containing: list[Mapping[str, Any]] = []
    for symbol in symbols:
        line_range = symbol["range"]
        start = int(line_range["startLine"])
        end = int(line_range["endLine"])
        if start <= hunk.new_start and hunk.new_end <= end:
            fully_containing.append(symbol)
        if start <= hunk.new_start <= end or start <= hunk.new_end <= end:
            containing.append(symbol)

    if fully_containing:
        smallest = min(
            fully_containing,
            key=lambda symbol: int(symbol["range"]["endLine"]) - int(symbol["range"]["startLine"]),
        )
        return str(smallest["name"])

    if not containing:
        return None

    smallest = min(containing, key=lambda symbol: int(symbol["range"]["endLine"]) - int(symbol["range"]["startLine"]))
    return str(smallest["name"])


def _walk_named(root: Any) -> Iterable[Any]:
    stack = [root]
    while stack:
        node = stack.pop()
        yield node
        stack.extend(reversed(_named_children(node)))


def _walk_all(root: Any) -> Iterable[Any]:
    stack = [root]
    while stack:
        node = stack.pop()
        yield node
        stack.extend(reversed(_children(node)))


def _children(node: Any) -> list[Any]:
    raw_children = getattr(node, "children", None)
    if isinstance(raw_children, list):
        return raw_children
    if isinstance(raw_children, tuple):
        return list(raw_children)

    count = getattr(node, "child_count", None)
    child = getattr(node, "child", None)
    if isinstance(count, int) and callable(child):
        return [child(index) for index in range(count)]

    return _named_children(node)


def _named_children(node: Any) -> list[Any]:
    children = getattr(node, "named_children", None)
    if isinstance(children, list):
        return children
    if isinstance(children, tuple):
        return list(children)

    count = getattr(node, "named_child_count", None)
    named_child = getattr(node, "named_child", None)
    if isinstance(count, int) and callable(named_child):
        return [named_child(index) for index in range(count)]

    raw_children = getattr(node, "children", None)
    if isinstance(raw_children, list):
        return [child for child in raw_children if _node_is_named(child)]
    if isinstance(raw_children, tuple):
        return [child for child in raw_children if _node_is_named(child)]
    return []


def _child_by_field_name(node: Any, field_name: str) -> Any | None:
    child_by_field_name = getattr(node, "child_by_field_name", None)
    if callable(child_by_field_name):
        return child_by_field_name(field_name)
    fields = getattr(node, "fields", None)
    if isinstance(fields, Mapping):
        return fields.get(field_name)
    return None


def _first_child_of_type(node: Any, node_types: set[str]) -> Any | None:
    for child in _named_children(node):
        if _node_type(child) in node_types:
            return child
    return None


def _has_ancestor_type(node: Any, node_type: str) -> bool:
    current = _parent(node)
    while current is not None:
        if _node_type(current) == node_type:
            return True
        current = _parent(current)
    return False


def _parent(node: Any) -> Any | None:
    parent = getattr(node, "parent", None)
    return parent() if callable(parent) else parent


def _node_type(node: Any) -> str:
    return str(getattr(node, "type", ""))


def _node_is_named(node: Any) -> bool:
    value = getattr(node, "is_named", True)
    return bool(value() if callable(value) else value)


def _node_has_error(node: Any) -> bool:
    value = getattr(node, "has_error", False)
    return bool(value() if callable(value) else value)


def _node_is_missing(node: Any) -> bool:
    value = getattr(node, "is_missing", False)
    return bool(value() if callable(value) else value)


def _node_start_line(node: Any) -> int:
    return _point_line(getattr(node, "start_point", (0, 0)))


def _node_end_line(node: Any) -> int:
    end_point = getattr(node, "end_point", (0, 0))
    row = _point_row(end_point)
    column = _point_column(end_point)
    if column == 0 and _node_end_byte(node) > _node_start_byte(node):
        return max(row, 1)
    return row + 1


def _point_line(point: Any) -> int:
    return _point_row(point) + 1


def _point_row(point: Any) -> int:
    row = getattr(point, "row", None)
    if row is None and isinstance(point, tuple) and point:
        row = point[0]
    return int(row or 0)


def _point_column(point: Any) -> int:
    column = getattr(point, "column", None)
    if column is None and isinstance(point, tuple) and len(point) > 1:
        column = point[1]
    return int(column or 0)


def _node_start_byte(node: Any) -> int:
    return int(getattr(node, "start_byte", 0) or 0)


def _node_end_byte(node: Any) -> int:
    return int(getattr(node, "end_byte", 0) or 0)


def _text(node: Any | None, source_bytes: bytes) -> str:
    if node is None:
        return ""
    text = getattr(node, "text", None)
    if isinstance(text, bytes):
        return text.decode("utf-8", errors="replace")
    if isinstance(text, str):
        return text
    return source_bytes[_node_start_byte(node) : _node_end_byte(node)].decode("utf-8", errors="replace")


def _count_all_nodes(root: Any, predicate: Any) -> int:
    return sum(1 for node in _walk_all(root) if predicate(node))


def _strip_quotes(value: str) -> str:
    stripped = value.strip()
    if len(stripped) >= 2 and stripped[0] == stripped[-1] and stripped[0] in {'"', "'"}:
        return stripped[1:-1]
    return stripped


def _clean_scalar(value: str) -> str:
    return _strip_quotes(value.strip().rstrip(":"))


def _dedupe_strings(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        stripped = _strip_quotes(value).strip()
        if stripped and stripped not in seen:
            seen.add(stripped)
            result.append(stripped)
    return result


def _package_version(package_name: str) -> str | None:
    try:
        return importlib.metadata.version(package_name)
    except importlib.metadata.PackageNotFoundError:
        return None
