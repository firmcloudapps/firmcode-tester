import React from "react";
import { renderToString } from "react-dom/server";
import type { WorkspaceBillingResponse } from "@firmcode/shared";
import { BillingView } from "../components/dashboard/billing-view";

describe("BillingView", () => {
  it("renders an active Clerk billing portal link for authorized billing managers", () => {
    const html = renderToString(
      <BillingView state={{ status: "populated", data: billing }} billingPortalUrl="https://accounts.example.com/billing" />
    );

    expect(html).toContain("Subscription");
    expect(html).toContain('href="https://accounts.example.com/billing"');
    expect(html).toContain("Manage subscription");
  });

  it("does not offer billing management as an active control when authorization fails", () => {
    const html = renderToString(<BillingView state={{ status: "error", message: "Dashboard API returned 403" }} billingPortalUrl={null} />);

    expect(html).toContain("Billing could not be loaded");
    expect(html).toContain("disabled=\"\"");
    expect(html).not.toContain("href=");
  });
});

const billing: WorkspaceBillingResponse = {
  workspace: {
    id: "workspace-1",
    role: "owner",
    canManageBilling: true,
    source: "clerk"
  },
  plan: {
    name: "Clerk managed",
    status: "managed_by_clerk"
  },
  usage: {
    reviewRunsThisMonth: null,
    aiTokensThisMonth: null,
    repositoriesMonitored: null,
    seats: null
  }
};
