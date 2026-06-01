import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { OverviewView } from "../../components/dashboard/overview-view";
import { loadOverviewState, resolveDashboardNavRole } from "../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [state, role] = await Promise.all([loadOverviewState(), resolveDashboardNavRole()]);

  return (
    <DashboardShell activeItem="Overview" role={role}>
      <OverviewView state={state} />
    </DashboardShell>
  );
}
