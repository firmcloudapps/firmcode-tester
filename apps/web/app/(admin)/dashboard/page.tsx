import { AdminDashboardShell } from "../../../components/dashboard/admin-dashboard-shell";
import { OverviewView } from "../../../components/dashboard/overview-view";
import { loadOverviewState } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const state = await loadOverviewState();

  return (
    <AdminDashboardShell activeItem="Overview">
      <OverviewView state={state} />
    </AdminDashboardShell>
  );
}
