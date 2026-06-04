import { DeveloperDashboardShell } from "../../../components/dashboard/developer-dashboard-shell";
import { CiFailuresView } from "../../../components/dashboard/ci-failures-view";
import { loadCiFailuresState } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface CiFailuresPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function CiFailuresPage({ searchParams = {} }: CiFailuresPageProps) {
  const state = await loadCiFailuresState(searchParams);

  return (
    <DeveloperDashboardShell activeItem="CI Failures">
      <CiFailuresView state={state} />
    </DeveloperDashboardShell>
  );
}
