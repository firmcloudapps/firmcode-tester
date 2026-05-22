export type FirmcodeAiActivityKind = "scanning" | "summary";

export type FirmcodeAiScanningStatus = "queued" | "running";

export interface FirmcodeAiScanningActivityInput {
  readonly reviewRunId: string;
  readonly repositoryFullName: string;
  readonly pullRequestNumber: number;
  readonly headSha: string;
  readonly triggerEvent: string;
  readonly status?: FirmcodeAiScanningStatus;
  readonly selectedFileCount?: number | null;
  readonly skippedFileCount?: number | null;
}

export interface FirmcodeAiSummaryActivityInput {
  readonly reviewRunId: string;
  readonly repositoryFullName: string;
  readonly pullRequestNumber: number;
  readonly headSha: string;
  readonly summaryBody: string;
  readonly riskLevel?: "low" | "medium" | "high" | null;
  readonly changedComponents?: readonly string[];
  readonly findingCount?: number | null;
  readonly inlineCommentCount?: number | null;
  readonly testSuggestions?: readonly string[];
}

export const FIRMCODEAI_SCANNING_COMMENT_MARKER = "<!-- firmcodeai:activity:scanning:v1 -->";
export const FIRMCODEAI_SUMMARY_COMMENT_MARKER = "<!-- firmcodeai:activity:summary:v1 -->";

const FIRMCODEAI_BANNER = [
  "```text",
  "|----------------------|",
  "|      FIRMCODEAI      |",
  "|----------------------|",
  "```"
].join("\n");

export function renderFirmcodeAiScanningActivity(input: FirmcodeAiScanningActivityInput): string {
  const status = input.status ?? "queued";
  const selectedFileCount = input.selectedFileCount ?? null;
  const skippedFileCount = input.skippedFileCount ?? null;

  return [
    FIRMCODEAI_SCANNING_COMMENT_MARKER,
    FIRMCODEAI_BANNER,
    "## FirmcodeAI Scanning",
    "",
    "> [!NOTE]",
    `> ${status === "running" ? "Currently scanning" : "Queued to scan"} new changes in this PR. This may take a few minutes.`,
    "",
    "<details>",
    "<summary>Run configuration</summary>",
    "",
    `- Repository: \`${input.repositoryFullName}\``,
    `- Pull request: #${input.pullRequestNumber}`,
    `- Trigger: \`${input.triggerEvent}\``,
    `- Head SHA: \`${shortSha(input.headSha)}\``,
    `- Review run: \`${input.reviewRunId}\``,
    "",
    "</details>",
    "",
    "<details>",
    "<summary>FirmcodeAI activity</summary>",
    "",
    "- Webhook accepted",
    "- Review job queued",
    "- Changed-file workspace will preserve repository-relative paths",
    "- Semgrep, semantic extraction, and review generation will run where supported",
    selectedFileCount === null ? "- Files selected for processing: pending" : `- Files selected for processing: ${selectedFileCount}`,
    skippedFileCount === null ? "- Skipped files: pending" : `- Skipped files: ${skippedFileCount}`,
    "",
    "</details>",
    "",
    "<sub>FirmcodeAI updates this comment as review activity progresses.</sub>"
  ].join("\n");
}

export function renderFirmcodeAiSummaryActivity(input: FirmcodeAiSummaryActivityInput): string {
  const changedComponents = input.changedComponents ?? [];
  const testSuggestions = input.testSuggestions ?? [];
  const findingCount = input.findingCount ?? null;
  const inlineCommentCount = input.inlineCommentCount ?? null;

  return [
    FIRMCODEAI_SUMMARY_COMMENT_MARKER,
    FIRMCODEAI_BANNER,
    "## FirmcodeAI Summary",
    "",
    input.summaryBody.trim(),
    "",
    "### Review activity",
    "",
    `- Repository: \`${input.repositoryFullName}\``,
    `- Pull request: #${input.pullRequestNumber}`,
    `- Head SHA: \`${shortSha(input.headSha)}\``,
    `- Review run: \`${input.reviewRunId}\``,
    input.riskLevel ? `- Risk: ${input.riskLevel}` : "- Risk: not classified",
    findingCount === null ? "- Findings: not reported" : `- Findings: ${findingCount}`,
    inlineCommentCount === null ? "- Inline comments: not reported" : `- Inline comments: ${inlineCommentCount}`,
    "",
    renderOptionalDetails("Changed components", changedComponents),
    renderOptionalDetails("Test suggestions", testSuggestions),
    "<sub>FirmcodeAI grounds comments in changed lines, deterministic scanner output, semantic facts, CI logs, or repository policy.</sub>"
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function firmcodeAiActivityMarker(kind: FirmcodeAiActivityKind): string {
  return kind === "scanning" ? FIRMCODEAI_SCANNING_COMMENT_MARKER : FIRMCODEAI_SUMMARY_COMMENT_MARKER;
}

export function isFirmcodeAiActivityComment(body: string, kind: FirmcodeAiActivityKind): boolean {
  return body.includes(firmcodeAiActivityMarker(kind));
}

function renderOptionalDetails(title: string, values: readonly string[]): string | null {
  if (values.length === 0) {
    return null;
  }

  return ["<details>", `<summary>${title}</summary>`, "", ...values.map((value) => `- ${value}`), "", "</details>", ""].join(
    "\n"
  );
}

function shortSha(value: string): string {
  return value.length > 12 ? value.slice(0, 12) : value;
}
