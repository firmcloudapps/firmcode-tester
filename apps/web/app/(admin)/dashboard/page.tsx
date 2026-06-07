import { AdminDashboardShell } from "../../../components/dashboard/admin-dashboard-shell";
import { AdminOverviewView } from "../../../components/dashboard/admin-overview-view";
import { loadAdminOverviewState } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const state = await loadAdminOverviewState();

  return (
    <AdminDashboardShell activeItem="Overview">
      <AdminOverviewView state={state} />
    </AdminDashboardShell>
  );
}
