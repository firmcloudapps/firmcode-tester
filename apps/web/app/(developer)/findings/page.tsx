import { DeveloperDashboardShell } from "../../../components/dashboard/developer-dashboard-shell";
import { FindingsView } from "../../../components/dashboard/findings-view";
import { loadFindingsState } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface FindingsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function FindingsPage({ searchParams = {} }: FindingsPageProps) {
  const state = await loadFindingsState(searchParams);

  return (
    <DeveloperDashboardShell activeItem="Findings">
      <FindingsView state={state} />
    </DeveloperDashboardShell>
  );
}
