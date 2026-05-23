from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from firmcode_worker.tree_sitter.extractor import ChangedHunk


CONTEXT_CHUNK_ARTIFACT_SCHEMA_VERSION = "context-chunks/v1"


class ContextBudgetError(ValueError):
    pass


@dataclass(frozen=True)
class SyntaxAwareSourceFile:
    path: str
    content: str
    changed_lines: tuple[int, ...]
    hunks: tuple[ChangedHunk, ...]
    language: str | None = None


@dataclass(frozen=True)
class SyntaxAwareChunkOptions:
    max_chars: int = 6_000
    max_tokens: int | None = None
    context_lines: int = 2
    token_counter: Callable[[str], int] | None = None


@dataclass(frozen=True)
class _LineRange:
    start_line: int
    end_line: int

    def line_count(self) -> int:
        return max(0, self.end_line - self.start_line + 1)


@dataclass(frozen=True)
class _RenderedChunk:
    selected_lines: frozenset[int]
    text: str
    char_count: int
    token_count: int


def build_syntax_aware_context_artifact(
    *,
    review_run_id: str,
    files: Sequence[SyntaxAwareSourceFile],
    tree_sitter_artifact: Mapping[str, Any] | Any,
    options: SyntaxAwareChunkOptions | None = None,
) -> dict[str, Any]:
    chunk_options = options or SyntaxAwareChunkOptions()
    tree_files = _tree_sitter_file_map(tree_sitter_artifact)
    chunks = [
        _build_chunk(file=file, hunk=hunk, tree_file=tree_files.get(file.path), options=chunk_options)
        for file in files
        for hunk in file.hunks
    ]
    return {
        "schemaVersion": CONTEXT_CHUNK_ARTIFACT_SCHEMA_VERSION,
        "reviewRunId": review_run_id,
        "budget": {
            "maxChars": chunk_options.max_chars,
            "maxTokens": chunk_options.max_tokens,
            "contextLines": chunk_options.context_lines,
        },
        "chunks": chunks,
    }


def _build_chunk(
    *,
    file: SyntaxAwareSourceFile,
    hunk: ChangedHunk,
    tree_file: Any | None,
    options: SyntaxAwareChunkOptions,
) -> dict[str, Any]:
    lines = file.content.splitlines()
    file_line_count = len(lines)
    hunk_range = _clamp_range(_LineRange(hunk.new_start, hunk.new_end), file_line_count)
    changed_lines = tuple(
        line
        for line in sorted(set(file.changed_lines))
        if hunk_range.start_line <= line <= hunk_range.end_line and 1 <= line <= file_line_count
    )
    mandatory_lines = frozenset(changed_lines or range(hunk_range.start_line, hunk_range.end_line + 1))
    enclosing_symbol = _smallest_enclosing_symbol(tree_file, hunk_range)
    imports = _imports(tree_file)

    render_context = {
        "path": file.path,
        "language": _value(tree_file, "language") or file.language,
        "hunk_range": hunk_range,
        "changed_lines": frozenset(changed_lines),
        "enclosing_symbol": enclosing_symbol,
        "imports": imports,
        "lines": lines,
    }
    rendered = _render_with_budget(
        selected_lines=mandatory_lines,
        candidate_ranges=_candidate_ranges(
            hunk_range=hunk_range,
            enclosing_symbol=enclosing_symbol,
            imports=imports,
            context_lines=options.context_lines,
            file_line_count=file_line_count,
        ),
        render_context=render_context,
        options=options,
    )

    included_imports = [
        item
        for item in imports
        if int(_value(item, "line") or 0) in rendered.selected_lines
    ]
    included_range = _selected_line_range(rendered.selected_lines)

    return {
        "id": f"{file.path}:{hunk_range.start_line}-{hunk_range.end_line}",
        "path": file.path,
        "language": render_context["language"] or "unknown",
        "range": {"startLine": included_range.start_line, "endLine": included_range.end_line},
        "hunkRange": {"startLine": hunk_range.start_line, "endLine": hunk_range.end_line},
        "changedLines": list(changed_lines or sorted(mandatory_lines)),
        "enclosingSymbol": _symbol_payload(enclosing_symbol),
        "imports": [_import_payload(item) for item in included_imports],
        "text": rendered.text,
        "charCount": rendered.char_count,
        "tokenCount": rendered.token_count,
        "truncated": not _all_relevant_lines_included(rendered.selected_lines, hunk_range, enclosing_symbol),
    }


def _render_with_budget(
    *,
    selected_lines: frozenset[int],
    candidate_ranges: Sequence[_LineRange],
    render_context: Mapping[str, Any],
    options: SyntaxAwareChunkOptions,
) -> _RenderedChunk:
    rendered = _render_chunk(selected_lines=selected_lines, render_context=render_context, options=options)
    if not _within_budget(rendered, options):
        raise ContextBudgetError(
            f"changed lines for {render_context['path']} exceed context budget "
            f"({rendered.char_count} chars, {rendered.token_count} tokens)"
        )

    for candidate_range in candidate_ranges:
        candidate_lines = frozenset(range(candidate_range.start_line, candidate_range.end_line + 1))
        expanded = rendered.selected_lines | candidate_lines
        candidate = _render_chunk(selected_lines=expanded, render_context=render_context, options=options)
        if _within_budget(candidate, options):
            rendered = candidate

    return rendered


def _candidate_ranges(
    *,
    hunk_range: _LineRange,
    enclosing_symbol: Any | None,
    imports: Sequence[Any],
    context_lines: int,
    file_line_count: int,
) -> list[_LineRange]:
    ranges: list[_LineRange] = [hunk_range]

    if enclosing_symbol is not None:
        symbol_range = _symbol_range(enclosing_symbol)
        ranges.append(_LineRange(symbol_range.start_line, symbol_range.start_line))

    ranges.extend(
        _LineRange(line, line)
        for line in sorted({int(_value(import_value, "line") or 0) for import_value in imports})
        if line > 0
    )

    ranges.append(
        _clamp_range(
            _LineRange(hunk_range.start_line - context_lines, hunk_range.end_line + context_lines),
            file_line_count,
        )
    )

    if enclosing_symbol is not None:
        ranges.append(_clamp_range(_symbol_range(enclosing_symbol), file_line_count))

    return ranges


def _render_chunk(
    *,
    selected_lines: frozenset[int],
    render_context: Mapping[str, Any],
    options: SyntaxAwareChunkOptions,
) -> _RenderedChunk:
    source_lines: Sequence[str] = render_context["lines"]
    sorted_lines = sorted(line for line in selected_lines if 0 < line <= len(source_lines))
    text_lines = [
        f"File: {render_context['path']}",
        f"Hunk: {_range_label(render_context['hunk_range'])}",
    ]
    language = render_context.get("language")
    if language:
        text_lines.append(f"Language: {language}")

    symbol = render_context.get("enclosing_symbol")
    if symbol is not None:
        symbol_range = _symbol_range(symbol)
        text_lines.append(
            f"Scope: {_value(symbol, 'kind') or 'symbol'} {_value(symbol, 'name')} {_range_label(symbol_range)}"
        )

    included_imports = [
        item
        for item in render_context["imports"]
        if int(_value(item, "line") or 0) in selected_lines
    ]
    if included_imports:
        text_lines.append("Imports: " + "; ".join(_import_label(item) for item in included_imports))

    previous_line: int | None = None
    changed_lines: frozenset[int] = render_context["changed_lines"]
    for line_number in sorted_lines:
        if previous_line is not None and line_number > previous_line + 1:
            text_lines.append("...")
        marker = "*" if line_number in changed_lines else " "
        text_lines.append(f"{marker}{line_number:>4} | {source_lines[line_number - 1]}")
        previous_line = line_number

    text = "\n".join(text_lines)
    token_count = _count_tokens(text, options)
    return _RenderedChunk(
        selected_lines=frozenset(sorted_lines),
        text=text,
        char_count=len(text),
        token_count=token_count,
    )


def _within_budget(rendered: _RenderedChunk, options: SyntaxAwareChunkOptions) -> bool:
    if rendered.char_count > options.max_chars:
        return False
    if options.max_tokens is not None and rendered.token_count > options.max_tokens:
        return False
    return True


def _count_tokens(text: str, options: SyntaxAwareChunkOptions) -> int:
    if options.token_counter is not None:
        return options.token_counter(text)
    return max(1, (len(text) + 3) // 4) if text else 0


def _tree_sitter_file_map(tree_sitter_artifact: Mapping[str, Any] | Any) -> dict[str, Any]:
    raw_files = _value(tree_sitter_artifact, "files") or []
    return {str(_value(file, "path")): file for file in raw_files if _value(file, "path")}


def _smallest_enclosing_symbol(tree_file: Any | None, line_range: _LineRange) -> Any | None:
    symbols = _value(tree_file, "symbols") or []
    containing = [
        symbol
        for symbol in symbols
        if _symbol_range(symbol).start_line <= line_range.start_line
        and line_range.end_line <= _symbol_range(symbol).end_line
    ]
    if not containing:
        intersecting = [
            symbol
            for symbol in symbols
            if _ranges_intersect(_symbol_range(symbol), line_range)
        ]
        containing = intersecting
    if not containing:
        return None
    return min(containing, key=lambda symbol: (_symbol_range(symbol).line_count(), _symbol_range(symbol).start_line))


def _imports(tree_file: Any | None) -> list[Any]:
    return list(_value(tree_file, "imports") or [])


def _symbol_range(symbol: Any) -> _LineRange:
    line_range = _value(symbol, "range") or {}
    return _LineRange(
        int(_value(line_range, "startLine") or getattr(line_range, "start_line", 1)),
        int(_value(line_range, "endLine") or getattr(line_range, "end_line", 1)),
    )


def _selected_line_range(selected_lines: frozenset[int]) -> _LineRange:
    if not selected_lines:
        return _LineRange(1, 1)
    return _LineRange(min(selected_lines), max(selected_lines))


def _clamp_range(line_range: _LineRange, file_line_count: int) -> _LineRange:
    if file_line_count <= 0:
        return _LineRange(1, 1)
    start_line = min(file_line_count, max(1, line_range.start_line))
    end_line = min(file_line_count, max(start_line, line_range.end_line))
    return _LineRange(start_line, end_line)


def _ranges_intersect(left: _LineRange, right: _LineRange) -> bool:
    return left.start_line <= right.end_line and right.start_line <= left.end_line


def _all_relevant_lines_included(
    selected_lines: frozenset[int],
    hunk_range: _LineRange,
    enclosing_symbol: Any | None,
) -> bool:
    if not set(range(hunk_range.start_line, hunk_range.end_line + 1)).issubset(selected_lines):
        return False
    if enclosing_symbol is None:
        return True
    symbol_range = _symbol_range(enclosing_symbol)
    return set(range(symbol_range.start_line, symbol_range.end_line + 1)).issubset(selected_lines)


def _symbol_payload(symbol: Any | None) -> dict[str, Any] | None:
    if symbol is None:
        return None
    line_range = _symbol_range(symbol)
    return {
        "name": _value(symbol, "name"),
        "kind": _value(symbol, "kind"),
        "range": {"startLine": line_range.start_line, "endLine": line_range.end_line},
    }


def _import_payload(import_value: Any) -> dict[str, Any]:
    return {
        "source": _value(import_value, "source"),
        "symbols": list(_value(import_value, "symbols") or []),
        "line": int(_value(import_value, "line") or 0),
    }


def _import_label(import_value: Any) -> str:
    symbols = list(_value(import_value, "symbols") or [])
    source = _value(import_value, "source")
    if symbols:
        return f"{source} ({', '.join(symbols)})"
    return str(source)


def _range_label(line_range: _LineRange) -> str:
    if line_range.start_line == line_range.end_line:
        return f"L{line_range.start_line}"
    return f"L{line_range.start_line}-L{line_range.end_line}"


def _value(source: Any, key: str) -> Any:
    if source is None:
        return None
    if isinstance(source, Mapping):
        return source.get(key)
    snake_key = _camel_to_snake(key)
    return getattr(source, snake_key, getattr(source, key, None))


def _camel_to_snake(value: str) -> str:
    result = []
    for character in value:
        if character.isupper():
            result.append("_")
            result.append(character.lower())
        else:
            result.append(character)
    return "".join(result).lstrip("_")
