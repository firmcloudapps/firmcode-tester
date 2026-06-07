import { createWebClerkConfig } from "@firmcode/shared";
import { BillingView } from "../../../components/dashboard/billing-view";
import { AdminDashboardShell } from "../../../components/dashboard/admin-dashboard-shell";
import { loadBillingState } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const billingPortalUrl = tryReadBillingPortalUrl();
  const state = await loadBillingState();

  return (
    <AdminDashboardShell activeItem="Billing">
      <BillingView state={state} billingPortalUrl={billingPortalUrl} />
    </AdminDashboardShell>
  );
}

function tryReadBillingPortalUrl(): string | null {
  try {
    return createWebClerkConfig(process.env).billingPortalUrl;
  } catch {
    return null;
  }
}
