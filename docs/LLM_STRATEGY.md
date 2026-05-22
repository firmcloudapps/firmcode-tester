# LLM Strategy

Firmcode uses deterministic tools first and LLM reasoning second. The LLM should explain and prioritize evidence, not invent findings.

## Provider Strategy

MVP implementation should use a provider-neutral interface:

```text
LLMClient
├── completeStructured(prompt, schema, options)
├── repairStructuredOutput(raw, schema)
└── estimateCost(usage)
```

The first provider can be selected by `LLM_PROVIDER`, with model names supplied by environment variables. The application should not hard-code provider-specific behavior outside the adapter.

## Model Roles

- Review reasoning model: strongest configured model, used for final PR review findings.
- Summary model: cheaper/faster model, used for PR summaries if configured.
- CI explanation model: cheaper/faster model unless CI context is complex.
- Repair model: same or cheaper model for one structured-output repair attempt.

## Failure Behavior

- If Semgrep succeeds and LLM fails, publish deterministic Semgrep findings in dry run or configured publish mode.
- If LLM output is invalid, attempt one repair.
- If repair fails, mark review run as failed or partial depending on publisher policy.
- Never post unvalidated model output to GitHub.
- Large PRs can fall back to summary-only mode.

## Prompt Versioning

Every prompt template must have:

- `prompt_id`
- `version`
- `schema_version`
- changelog entry
- fixture coverage

Every review run should persist:

- prompt IDs and versions used
- model names
- token usage
- raw or redacted prompt artifact key when retention allows
- raw or redacted response artifact key when retention allows

## Output Schema

The final review output should include:

- `summary`
- `risk_level`
- `changed_components`
- `inline_findings`
- `summary_findings`
- `test_suggestions`
- `ci_explanation`
- `confidence`

Each finding must include:

- source
- category
- severity
- confidence
- file path
- line range when inline
- title
- body
- evidence
- suggested fix

## Context Packing Rules

- Include PR title, body, author, base/head refs, and commit messages when useful.
- Include changed hunks with line maps.
- Include Tree-sitter enclosing symbols and imports.
- Include Semgrep findings as deterministic evidence.
- Include CI log excerpts after redaction/truncation.
- Exclude generated/vendor/minified files unless the PR only changes those files.
- Preserve a list of skipped files and reasons.

## Evaluation Plan

Use golden fixtures:

- small bug PR
- security finding PR
- infrastructure PR
- CI failure PR
- large PR
- generated-file-heavy PR
- no-issue PR

Evaluation checks:

- valid JSON
- no inline comments outside changed lines
- evidence present for each finding
- severity is not overstated
- Semgrep findings are preserved
- noisy/comment-count limits are respected

