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
  const candidate =
    process.env.NEXT_PUBLIC_BILLING_PORTAL_URL ??
    process.env.BILLING_PORTAL_URL ??
    process.env.NEXT_PUBLIC_INSFORGE_BILLING_PORTAL_URL ??
    process.env.INSFORGE_BILLING_PORTAL_URL;

  if (candidate === undefined || candidate.trim() === "") {
    return null;
  }

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
