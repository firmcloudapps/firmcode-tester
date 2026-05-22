# Privacy And Data Retention

Firmcode processes sensitive repository data. Treat all diffs, file contents, PR text, CI logs, Semgrep results, and LLM prompts/responses as confidential.

## Data Classes

| Data | Sensitivity | Default Retention |
| --- | --- | --- |
| GitHub installation metadata | medium | Until installation removed. |
| Repository metadata | medium | Until repository disabled/deleted. |
| PR metadata | medium | 180 days. |
| Changed file patches | high | 30 days. |
| Full changed file snapshots | high | 14 days. |
| CI logs | high | 14 days. |
| LLM prompts/responses | high | 14 days, configurable. |
| Semgrep JSON output | medium/high | 30 days. |
| Tree-sitter artifacts | medium | 30 days. |
| Findings and published comment metadata | medium | 180 days. |
| Aggregated metrics | low | 365 days. |

## Redaction Rules

- Redact known secret patterns from logs and CI excerpts before storage or display.
- Never log GitHub App private keys, installation tokens, Clerk secrets, LLM keys, webhook signatures, or database URLs.
- Store raw CI logs only when needed for debugging and always behind retention controls.
- Show collapsed raw logs by default in the dashboard.

## Deletion Rules

- GitHub installation removal disables review automation and queues cleanup for installation-linked data.
- Repository disable stops new reviews but can retain historical findings until retention expires.
- Repository deletion request should remove raw artifacts immediately and metadata/findings within a bounded cleanup window.
- Clerk user/org deletion webhook should trigger workspace access cleanup and data deletion workflow.

## LLM Data Handling

- Prompts must delimit untrusted repository content.
- LLM prompts/responses should be stored only for debugging/evaluation when configured.
- Prompt artifacts must include prompt version, schema version, model, token usage, and redaction status.
- Do not send secrets intentionally to the LLM. Use redaction before context packing where practical.

## Dashboard Access

- Only authorized workspace members can view repository data, review runs, artifacts, logs, and findings.
- Billing and member-management pages require elevated workspace role.

## MVP Defaults

- Default to dry-run mode during setup.
- Default artifact retention to 30 days or less.
- Allow repository allowlist for personal MVP.
- Do not train or fine-tune on user repository content.

