import { DeveloperDashboardShell } from "../../../../components/dashboard/developer-dashboard-shell";
import { CiFailureDetailView } from "../../../../components/dashboard/ci-failures-view";
import { loadCiFailureDetailState } from "../../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface CiFailureDetailPageProps {
  params: {
    id: string;
  };
}

export default async function CiFailureDetailPage({ params }: CiFailureDetailPageProps) {
  const state = await loadCiFailureDetailState(params.id);

  return (
    <DeveloperDashboardShell activeItem="CI Failures">
      <CiFailureDetailView state={state} />
    </DeveloperDashboardShell>
  );
}
