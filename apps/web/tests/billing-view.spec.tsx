import React from "react";
import { renderToString } from "react-dom/server";
import type { WorkspaceBillingResponse } from "@firmcode/shared";
import { BillingView } from "../components/dashboard/billing-view";

describe("BillingView", () => {
  it("renders an active billing portal link for authorized billing managers", () => {
    const html = renderToString(
      <BillingView state={{ status: "populated", data: billing }} billingPortalUrl="https://billing.insforge.app/workspace" />
    );

    expect(html).toContain("Subscription");
    expect(html).toContain("Monthly review runs");
    expect(html).toContain("12 runs");
    expect(html).toContain("42,000 tokens");
    expect(html).toContain("3 monitored");
    expect(html).toContain("5 seats");
    expect(html).toContain("InsForge managed");
    expect(html).toContain('href="https://billing.insforge.app/workspace"');
    expect(html).toContain("Manage subscription");
  });

  it("renders a disabled management control when the billing portal URL is missing", () => {
    const html = renderToString(<BillingView state={{ status: "populated", data: billing }} billingPortalUrl={null} />);

    expect(html).toContain("Billing portal URL is not configured.");
    expect(html).toContain("disabled=\"\"");
    expect(html).not.toContain("href=");
  });

  it("shows Developers usage context and an upgrade prompt without subscription management", () => {
    const html = renderToString(
      <BillingView
        state={{ status: "populated", data: { ...billing, workspace: { ...billing.workspace, role: "developer", canManageBilling: false } } }}
        billingPortalUrl="https://billing.insforge.app/workspace"
      />
    );

    expect(html).toContain("Developers can review current plan and usage context.");
    expect(html).toContain("Admin permission is required to manage subscriptions.");
    expect(html).toContain("disabled=\"\"");
    expect(html).not.toContain('href="https://billing.insforge.app/workspace"');
  });

  it("renders a loading state while billing context is fetched", () => {
    const html = renderToString(<BillingView state={{ status: "loading" }} billingPortalUrl={null} />);

    expect(html).toContain("Subscription");
    expect(html).toContain('aria-label="Loading billing"');
    expect(html).not.toContain("Manage subscription");
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
    role: "admin",
    canManageBilling: true,
    source: "insforge"
  },
  plan: {
    name: "InsForge managed",
    status: "active"
  },
  usage: {
    reviewRunsThisMonth: 12,
    aiTokensThisMonth: 42000,
    repositoriesMonitored: 3,
    seats: 5
  }
};
