import { loadWebClerkConfig } from "../../config/clerk";
import { BillingView } from "../../components/dashboard/billing-view";
import { loadBillingState } from "../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const billingPortalUrl = tryReadBillingPortalUrl();
  const state = await loadBillingState();

  return <BillingView state={state} billingPortalUrl={billingPortalUrl} />;
}

function tryReadBillingPortalUrl(): string | null {
  try {
    return loadWebClerkConfig(process.env).billingPortalUrl;
  } catch {
    return null;
  }
}
