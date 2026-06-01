import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { FindingsView } from "../../components/dashboard/findings-view";
import { loadFindingsState, resolveDashboardNavRole } from "../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface FindingsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function FindingsPage({ searchParams = {} }: FindingsPageProps) {
  const [state, role] = await Promise.all([loadFindingsState(searchParams), resolveDashboardNavRole()]);

  return (
    <DashboardShell activeItem="Findings" role={role}>
      <FindingsView state={state} />
    </DashboardShell>
  );
}
