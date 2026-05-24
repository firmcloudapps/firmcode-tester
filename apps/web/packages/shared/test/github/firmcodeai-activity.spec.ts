import { describe, expect, it } from "vitest";
import {
  FIRMCODEAI_SUMMARY_COMMENT_MARKER,
  isFirmcodeAiActivityComment,
  renderFirmcodeAiSummaryActivity
} from "../../src";

describe("FirmcodeAI GitHub activity Markdown", () => {
  it("renders a branded summary activity comment", () => {
    const markdown = renderFirmcodeAiSummaryActivity({
      reviewRunId: "run-1",
      repositoryFullName: "kelly-oriabure/firmcode-web",
      pullRequestNumber: 13,
      headSha: "5ccce2d5f1b0e7bedd6239418c39bb28740b741e",
      summaryBody: "This PR changes Semgrep scan workspace behavior.",
      riskLevel: "medium",
      changedComponents: ["Semgrep worker", "GitHub activity comments"],
      keyFindings: [
        {
          title: "GitHub comment update path needs coverage",
          severity: "medium",
          body: "The publisher should patch the existing marked comment during reruns.",
          path: "apps/api/src/infrastructure/github/github-pr-activity-publisher.ts",
          lineRange: { startLine: 42, endLine: 42 }
        }
      ],
      findingCount: 2,
      inlineCommentCount: 1,
      testSuggestions: ["Add an end-to-end webhook-to-comment smoke test."],
      ciExplanation: "CI was not available for this run."
    });

    expect(markdown).toContain(FIRMCODEAI_SUMMARY_COMMENT_MARKER);
    expect(markdown).toContain("|      FIRMCODEAI      |");
    expect(markdown).toContain("## FirmcodeAI Summary");
    expect(markdown).toContain("This PR changes Semgrep scan workspace behavior.");
    expect(markdown).toContain("- Level: medium");
    expect(markdown).toContain("- Findings: 2");
    expect(markdown).toContain("### Changed components");
    expect(markdown).toContain("### Key findings");
    expect(markdown).toContain("Add an end-to-end webhook-to-comment smoke test.");
    expect(markdown).toContain("CI was not available for this run.");
    expect(isFirmcodeAiActivityComment(markdown, "summary")).toBe(true);
  });

  it("matches the summary Markdown snapshot", () => {
    const markdown = renderFirmcodeAiSummaryActivity({
      reviewRunId: "run-snapshot",
      repositoryFullName: "kelly-oriabure/firmcode-web",
      pullRequestNumber: 21,
      headSha: "5ccce2d5f1b0e7bedd6239418c39bb28740b741e",
      summaryBody: "This PR updates webhook ingestion and review publishing.",
      riskLevel: "high",
      changedComponents: ["Webhook idempotency", "GitHub publisher", "Review contracts"],
      keyFindings: [
        {
          title: "Superseded runs must not publish",
          severity: "high",
          body: "Re-check the PR head SHA before writing comments.",
          path: "apps/api/src/modules/webhooks/github/github-webhook.store.ts",
          lineRange: { startLine: 320, endLine: 324 }
        },
        {
          title: "Summary reruns should update in place",
          severity: "medium",
          body: "Use the stable Firmcode marker to find the previous summary comment."
        }
      ],
      findingCount: 3,
      inlineCommentCount: 1,
      testSuggestions: ["Mock GitHub create and update paths.", "Snapshot the rendered Markdown summary."],
      ciExplanation: "The lint job failed before tests because the publisher type contract changed."
    });

    expect(markdown).toMatchSnapshot();
  });
});
