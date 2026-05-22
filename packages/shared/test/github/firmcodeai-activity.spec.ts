import { describe, expect, it } from "vitest";
import {
  FIRMCODEAI_SCANNING_COMMENT_MARKER,
  FIRMCODEAI_SUMMARY_COMMENT_MARKER,
  isFirmcodeAiActivityComment,
  renderFirmcodeAiScanningActivity,
  renderFirmcodeAiSummaryActivity
} from "../../src";

describe("FirmcodeAI GitHub activity Markdown", () => {
  it("renders a branded scanning activity comment with stable update marker", () => {
    const markdown = renderFirmcodeAiScanningActivity({
      reviewRunId: "run-1",
      repositoryFullName: "firmcloudapps/firmcode-tester",
      pullRequestNumber: 13,
      headSha: "5ccce2d5f1b0e7bedd6239418c39bb28740b741e",
      triggerEvent: "pull_request.synchronize",
      status: "running",
      selectedFileCount: 6,
      skippedFileCount: 1
    });

    expect(markdown).toContain(FIRMCODEAI_SCANNING_COMMENT_MARKER);
    expect(markdown).toContain("|      FIRMCODEAI      |");
    expect(markdown).toContain("## FirmcodeAI Scanning");
    expect(markdown).toContain("Currently scanning new changes");
    expect(markdown).toContain("<summary>Run configuration</summary>");
    expect(markdown).toContain("- Files selected for processing: 6");
    expect(markdown).toContain("- Skipped files: 1");
    expect(isFirmcodeAiActivityComment(markdown, "scanning")).toBe(true);
    expect(isFirmcodeAiActivityComment(markdown, "summary")).toBe(false);
  });

  it("renders a branded summary activity comment", () => {
    const markdown = renderFirmcodeAiSummaryActivity({
      reviewRunId: "run-1",
      repositoryFullName: "firmcloudapps/firmcode-tester",
      pullRequestNumber: 13,
      headSha: "5ccce2d5f1b0e7bedd6239418c39bb28740b741e",
      summaryBody: "This PR changes Semgrep scan workspace behavior.",
      riskLevel: "medium",
      changedComponents: ["Semgrep worker", "GitHub activity comments"],
      findingCount: 2,
      inlineCommentCount: 1,
      testSuggestions: ["Add an end-to-end webhook-to-comment smoke test."]
    });

    expect(markdown).toContain(FIRMCODEAI_SUMMARY_COMMENT_MARKER);
    expect(markdown).toContain("|      FIRMCODEAI      |");
    expect(markdown).toContain("## FirmcodeAI Summary");
    expect(markdown).toContain("This PR changes Semgrep scan workspace behavior.");
    expect(markdown).toContain("- Risk: medium");
    expect(markdown).toContain("- Findings: 2");
    expect(markdown).toContain("<summary>Changed components</summary>");
    expect(markdown).toContain("Add an end-to-end webhook-to-comment smoke test.");
    expect(isFirmcodeAiActivityComment(markdown, "summary")).toBe(true);
  });
});
