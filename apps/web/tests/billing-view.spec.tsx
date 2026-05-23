import React from "react";
import { renderToString } from "react-dom/server";
import type { WorkspaceBillingResponse } from "@firmcode/shared";
import { BillingView } from "../components/dashboard/billing-view";
import { DashboardShell } from "../components/dashboard/dashboard-shell";

describe("BillingView", () => {
  it("renders loading and elevated access error states", () => {
    expect(renderToString(<BillingView state={{ status: "loading" }} billingPortalUrl={null} />)).toContain("Loading billing");
    expect(
      renderToString(
        <BillingView
          state={{ status: "error", message: "Billing access requires workspace Owner/Admin or Clerk billing role." }}
          billingPortalUrl={null}
        />
      )
    ).toContain("Billing access denied");
  });

  it("renders populated plan, usage, status, and Clerk portal management link", () => {
    const html = renderToString(
      <BillingView state={{ status: "populated", data: billingResponse }} billingPortalUrl="https://accounts.clerk.example/billing" />
    );

    expect(html).toContain("Subscription and usage");
    expect(html).toContain("Clerk managed");
    expect(html).toContain("Monthly review runs");
    expect(html).toContain(">12<");
    expect(html).toContain("AI tokens");
    expect(html).toContain("25,400");
    expect(html).toContain("Repositories");
    expect(html).toContain(">4<");
    expect(html).toContain("Seats");
    expect(html).toContain(">3<");
    expect(html).toContain("Managed in Clerk");
    expect(html).toContain('href="https://accounts.clerk.example/billing"');
  });

  it("renders a clear disabled management state when the portal URL is missing", () => {
    const html = renderToString(<BillingView state={{ status: "populated", data: billingResponse }} billingPortalUrl={null} />);

    expect(html).toContain("Clerk Billing portal URL is not configured");
    expect(html).toContain("disabled=\"\"");
    expect(html).not.toContain('href="#"');
  });

  it("keeps billing behind the Clerk-authenticated dashboard shell scaffold", () => {
    const html = renderToString(
      <DashboardShell activeItem="Billing">
        <BillingView state={{ status: "populated", data: billingResponse }} billingPortalUrl="https://accounts.clerk.example/billing" />
      </DashboardShell>
    );

    expect(html).toContain('data-clerk-authenticated="required"');
    expect(html).toContain('href="/billing" aria-current="page"');
  });
});

const billingResponse: WorkspaceBillingResponse = {
  workspace: {
    id: "workspace-1",
    name: "Firmcode",
    role: "owner",
    canManageBilling: true,
    billingAccessSource: "workspace_role"
  },
  plan: {
    name: "Clerk managed",
    source: "clerk",
    description: "Plan, checkout, seats, invoices, and subscription mutations stay in Clerk Billing."
  },
  billingStatus: {
    label: "Managed in Clerk",
    source: "clerk"
  },
  usage: {
    monthlyReviewRuns: 12,
    aiTokens: 25400,
    repositories: 4,
    seats: 3,
    periodStart: "2026-05-01T00:00:00.000Z",
    periodEnd: "2026-06-01T00:00:00.000Z"
  }
};
