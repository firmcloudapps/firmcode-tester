import { DashboardShell } from "../components/dashboard/dashboard-shell";
import { OverviewView } from "../components/dashboard/overview-view";
import { loadOverviewState } from "../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const state = await loadOverviewState();

  return (
    <DashboardShell activeItem="Overview">
      <OverviewView state={state} />
    </DashboardShell>
  );
}
