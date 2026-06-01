import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { CiFailureDetailView } from "../../../components/dashboard/ci-failures-view";
import { loadCiFailureDetailState, resolveDashboardNavRole } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface CiFailureDetailPageProps {
  params: {
    id: string;
  };
}

export default async function CiFailureDetailPage({ params }: CiFailureDetailPageProps) {
  const [state, role] = await Promise.all([loadCiFailureDetailState(params.id), resolveDashboardNavRole()]);

  return (
    <DashboardShell activeItem="CI Failures" role={role}>
      <CiFailureDetailView state={state} />
    </DashboardShell>
  );
}
