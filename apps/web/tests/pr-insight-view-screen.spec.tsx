import React from "react";
import { renderToString } from "react-dom/server";
import { PrInsightViewScreen } from "../components/stitch/pr-insight-view-screen";

describe("PrInsightViewScreen", () => {
  it("renders the Stitch PR Insight View workspace shell", () => {
    const html = renderToString(<PrInsightViewScreen />);

    expect(html).toContain("Firmcode AI");
    expect(html).toContain("PR #402: Auth Redesign");
    expect(html).toContain("PR Insights");
    expect(html).toContain("AI Summary");
    expect(html).toContain("Active Insights (4)");
    expect(html).toContain("src/services/auth.service.ts");
    expect(html).toContain("Weak JWT Secret");
    expect(html).toContain("Fix Applied");
    expect(html).toContain("Accept Change");
    expect(html).toContain('aria-label="Approve PR"');
    expect(html).toContain("pr-insight-code-bg");
    expect(html).toContain("min-w-[1024px]");
  });
});
