# Reference Implementation Analysis

Firmcode should be inspired by the included repositories, not built by directly integrating their source code. These repositories are local study material for implementation patterns, edge cases, data structures, and review behavior.

## Ground Rule

- Do not vendor or import code from `pr-agent/`, `semgrep/`, or `tree-sitter/` into Firmcode.
- Do read the relevant implementation before building an analogous Firmcode component.
- Reimplement the needed behavior behind Firmcode-owned interfaces, tests, schemas, and runtime boundaries.
- Preserve licenses by treating reference code as design guidance, not copied implementation.

## PR-Agent Findings

Key files read:

- `pr-agent/pr_agent/tools/pr_reviewer.py`
- `pr-agent/pr_agent/tools/pr_code_suggestions.py`
- `pr-agent/pr_agent/algo/pr_processing.py`
- `pr-agent/pr_agent/algo/git_patch_processing.py`
- `pr-agent/pr_agent/algo/types.py`
- `pr-agent/pr_agent/git_providers/github_provider.py`
- `pr-agent/pr_agent/settings/pr_reviewer_prompts.toml`

### Useful Patterns

- Provider abstraction: PR-Agent isolates GitHub/GitLab/etc. behavior behind provider classes. Firmcode should use a `GitHubClient`/`GitProvider` adapter layer rather than calling Octokit directly from controllers or worker stages.
- Canonical file patch object: `FilePatchInfo` combines base content, head content, patch text, filename, edit type, added/deleted counts, tokens, language, and optional summaries. Firmcode should use a similar owned `ChangedFileArtifact` schema.
- Token-aware diff assembly: PR-Agent extends diffs with context while respecting token budgets, then falls back to compressed diff handling for large PRs. Firmcode should make context packing budget-aware from the first worker implementation.
- Hunk normalization: PR-Agent decouples hunks and adds new-side line numbers for model grounding. Firmcode should generate explicit hunk objects and changed-line maps rather than passing raw patch strings through the pipeline.
- Inline comment resilience: PR-Agent validates and falls back when GitHub rejects inline comments. Firmcode should pre-validate changed-line comments and keep a deterministic fallback to summary-only comments.
- Persistent comments: PR-Agent updates previous bot comments instead of spamming a PR. Firmcode summary comments should use a stable marker and update in place.
- Prompt schemas: PR-Agent uses prompt templates with explicit structured output definitions. Firmcode should prefer JSON schemas over free-form Markdown or YAML, but keep the same discipline of schema-first prompting.
- Progress comments and dry-run style: PR-Agent separates generation from publishing through config. Firmcode should support dry run from the beginning.

### Firmcode Adaptation

Build:

- `ReviewContextBuilder` to prepare bounded context packs.
- `DiffParser` and `LineMap` to determine changed-line eligibility.
- `ReviewPublisher` with summary update, inline batch publish, and fallback modes.
- `FindingDeduplicator` using source, rule, path, changed line, and evidence hash.
- `PromptRenderer` with versioned templates and JSON schema validation.

Do not build:

- Multi-provider VCS support for MVP.
- PR-Agent command router or chat modes.
- YAML model output parsing.
- Direct reuse of provider implementation.

## Semgrep Findings

Key files read:

- `semgrep/cli/src/semgrep/run_scan.py`
- `semgrep/cli/src/semgrep/target_manager.py`
- `semgrep/cli/src/semgrep/core_targets_plan.py`
- `semgrep/cli/src/semgrep/rule_match.py`
- `semgrep/cli/src/semgrep/formatter/json.py`
- `semgrep/cli/src/semgrep/semgrep_interfaces/semgrep_output_v1.jsonschema`
- `semgrep/src/osemgrep/cli_scan/Diff_scan.ml`

### Useful Patterns

- Explicit target planning: Semgrep separates scan roots, target selection, skipped paths, language mapping, and rule/product mapping. Firmcode should record why each changed file was scanned or skipped.
- Structured output contract: Semgrep JSON always includes `results`, `errors`, and `paths`. Firmcode should persist all three categories, not just findings.
- Stable finding identity: Semgrep hashes rule ID, path, syntactic context, pattern, and line content to identify findings across runs. Firmcode should use stable dedupe keys so reruns do not repost the same comment.
- Baseline/diff scan concept: Semgrep compares head findings to baseline findings and removes duplicates using rule, path, and syntactic context. Firmcode MVP can start with changed-file scans, but the schema should allow baseline-aware filtering later.
- Skipped path accounting: Semgrep records reasons such as ignored, size limit, permissions, language mismatch, and always-skipped directories. Firmcode should expose skipped files in artifacts and dashboard details.
- Severity/product normalization: Semgrep distinguishes SAST, SCA, and secrets and maps severity into structured categories. Firmcode should preserve source severity while translating into its own severity enum.
- Process boundary clarity: Semgrep CLI wraps core execution and normalizes errors. Firmcode should run Semgrep through a worker-owned process wrapper with timeout, stderr capture, and normalized failure modes.

### Firmcode Adaptation

Build:

- `SemgrepScanPlanner` for changed-file target selection.
- `SemgrepRunner` process wrapper with timeout and JSON parsing.
- `SemgrepNormalizer` that maps Semgrep JSON into Firmcode findings and artifacts.
- `ScanTargetLog` with scanned/skipped file records and reasons.
- `FindingIdentity` using rule ID, path, syntactic context hash, start/end line hashes, and source.

Do not build:

- Semgrep core integration.
- Full Semgrep rule engine.
- Semgrep Cloud/App behavior.
- Supply-chain reachability for MVP unless it falls out of `semgrep scan --json`.

## Tree-sitter Findings

Key files read:

- `tree-sitter/lib/binding_web/src/parser.ts`
- `tree-sitter/lib/binding_web/src/tree.ts`
- `tree-sitter/lib/binding_web/src/node.ts`
- `tree-sitter/lib/binding_web/src/query.ts`
- `tree-sitter/docs/src/using-parsers/2-basic-parsing.md`
- `tree-sitter/docs/src/using-parsers/4-walking-trees.md`
- `tree-sitter/docs/src/4-code-navigation.md`

### Useful Patterns

- Parser lifecycle: a parser has a selected language and returns a syntax tree. Firmcode should lazy-load parsers by language and treat parser load failures as per-file failures, not review failures.
- Range-aware parsing: Tree-sitter supports included ranges and progress callbacks. Firmcode can initially parse full changed files, but should keep timeouts/cancellation and future hunk-range parsing in the design.
- Node model: nodes expose type, named/anonymous status, byte range, row/column range, children, field names, error/missing status, and text. Firmcode semantic extraction should store both line and byte positions when available.
- Tree cursors: cursors are efficient for walking many nodes. Firmcode should use cursor/query-driven extraction for large files instead of repeated expensive child lookups.
- Query captures: Tree-sitter code navigation uses `@definition.function`, `@definition.class`, `@reference.call`, and `@name` captures. Firmcode should define per-language queries for symbols instead of hardcoding every grammar traversal.
- Error tolerance: nodes expose `hasError` and `isMissing`. Firmcode should record parse quality and avoid over-trusting incomplete parse output.
- Changed range support: Tree comparison can report changed syntactic ranges after edits. Firmcode may use this later for incremental parsing or baseline comparisons.

### Firmcode Adaptation

Build:

- `TreeSitterLanguageRegistry` with extension/language/parser mappings.
- `QueryLibrary` with per-language symbol/import/dependency queries.
- `SemanticExtractor` producing symbols, imports, references, parse status, and hunk scopes.
- `HunkScopeResolver` that maps changed lines to enclosing symbols.
- `ParseArtifact` storing parser version, grammar, errors, and extraction output.

Do not build:

- Custom grammars for MVP.
- Browser WASM parsing unless the dashboard later needs client-side code navigation.
- Full repository index before changed-file analysis works well.

## Cross-Reference Design Decisions

- Use Firmcode-owned schemas for all artifacts, but design them around the proven shapes above: file patch objects, Semgrep result/error/path groups, Tree-sitter symbol captures, and GitHub publish payloads.
- Keep deterministic stages before LLM stages: diff parsing, Semgrep, Tree-sitter, context packing, then LLM review.
- Store intermediate artifacts so every review run can be debugged without re-calling GitHub or the LLM.
- Enforce changed-line eligibility before inline publishing.
- Prefer schema validation and golden fixtures over manual spot checks.
- Keep reference-reading tasks explicit in future implementation prompts.

