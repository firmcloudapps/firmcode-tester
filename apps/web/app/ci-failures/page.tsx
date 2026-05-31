import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { CiFailuresView } from "../../components/dashboard/ci-failures-view";
import { loadCiFailuresState, resolveDashboardNavRole } from "../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface CiFailuresPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function CiFailuresPage({ searchParams = {} }: CiFailuresPageProps) {
  const [state, role] = await Promise.all([loadCiFailuresState(searchParams), resolveDashboardNavRole()]);

  return (
    <DashboardShell activeItem="CI Failures" role={role}>
      <CiFailuresView state={state} />
    </DashboardShell>
  );
}
