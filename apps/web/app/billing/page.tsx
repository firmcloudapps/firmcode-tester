import { loadWebClerkConfig } from "../../config/clerk";
import { BillingView } from "../../components/dashboard/billing-view";
import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { loadBillingState } from "../../lib/dashboard-data";
import { requireAdminDashboardAccess } from "../../lib/dashboard-guards";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const role = await requireAdminDashboardAccess();
  const billingPortalUrl = tryReadBillingPortalUrl();
  const state = await loadBillingState();

  return (
    <DashboardShell activeItem="Billing" role={role}>
      <BillingView state={state} billingPortalUrl={billingPortalUrl} />
    </DashboardShell>
  );
}

function tryReadBillingPortalUrl(): string | null {
  try {
    return loadWebClerkConfig(process.env).billingPortalUrl;
  } catch {
    return null;
  }
}
