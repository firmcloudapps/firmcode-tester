import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { FindingsView } from "../../components/dashboard/findings-view";
import { loadFindingsState } from "../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface FindingsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function FindingsPage({ searchParams = {} }: FindingsPageProps) {
  const state = await loadFindingsState(searchParams);

  return (
    <DashboardShell activeItem="Findings">
      <FindingsView state={state} />
    </DashboardShell>
  );
}
