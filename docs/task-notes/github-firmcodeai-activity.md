# GitHub FirmcodeAI Activity Notes

Implemented a branded GitHub activity comment surface for FirmcodeAI.

Reference files read:

- `pr-agent/pr_agent/git_providers/github_provider.py`
- `pr-agent/pr_agent/tools/pr_reviewer.py`
- `docs/REFERENCE_ANALYSIS.md`
- `docs/TASKS.md`

Implementation:

- Added shared Markdown renderers for `FirmcodeAI Scanning` and `FirmcodeAI Summary` comments.
- Added stable hidden markers so publisher code can update existing bot comments instead of spamming.
- Added a dashed/stroked `FIRMCODEAI` banner at the top of GitHub-facing activity comments.
- Added an API GitHub App activity publisher that exchanges an app JWT for an installation token, finds an existing scanning comment, and updates or creates it.
- Wired webhook ingestion to publish the `FirmcodeAI Scanning` activity after a review run is queued. Publishing is best-effort and does not fail webhook ingestion if GitHub is temporarily unavailable.

Operational notes:

- The GitHub App needs write access that permits pull request issue comments.
- Summary publishing can reuse `renderFirmcodeAiSummaryActivity` when the review publisher stage is implemented.

Tests:

- Shared Markdown renderer tests for scanning and summary activity comments.
- GitHub activity publisher tests for update behavior, JWT shape, and GitHub failure normalization.
- Webhook service tests verify scanning activity publishing and that publish failures do not block queued review jobs.
