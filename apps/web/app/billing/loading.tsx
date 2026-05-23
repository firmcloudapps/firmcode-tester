import { BillingView } from "../../components/dashboard/billing-view";
import { DashboardShell } from "../../components/dashboard/dashboard-shell";

export default function BillingLoading() {
  return (
    <DashboardShell activeItem="Billing">
      <BillingView state={{ status: "loading" }} billingPortalUrl={null} />
    </DashboardShell>
  );
}
