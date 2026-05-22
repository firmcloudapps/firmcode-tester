import React from "react";
import { renderToString } from "react-dom/server";
import { HealthSummary } from "../components/health-summary";

describe("HealthSummary", () => {
  it("renders shared health and review contract data", () => {
    const html = renderToString(<HealthSummary />);

    expect(html).toContain("Awaiting first review run");
    expect(html).toContain("web");
    expect(html).toContain("10");
  });
});
