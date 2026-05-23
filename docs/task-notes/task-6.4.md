# Task 6.4 Notes

Added deterministic LLM evaluation fixtures for the strategy cases in `docs/LLM_STRATEGY.md`:

- small bug PR
- security finding PR
- infrastructure PR
- CI failure PR
- large PR
- generated-file-heavy PR
- no-issue PR

The worker test suite loads frozen JSON responses from `apps/worker/tests/fixtures/llm_evaluation/golden-fixtures.json`, parses them through the shared worker contracts, runs normal review output preparation, and verifies:

- prompt ID, prompt version, and output schema version are pinned with expected outputs
- inline findings remain on changed lines
- findings include evidence
- severity does not exceed each fixture's allowed maximum
- required Semgrep findings are preserved as Semgrep-sourced output after dedupe
- inline comment counts stay within fixture limits

Run locally with:

```bash
python3 -m pytest apps/worker/tests/test_llm_evaluation_fixtures.py
```
