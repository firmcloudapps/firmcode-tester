import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { PullRequestDetailView } from "../../../components/dashboard/pull-requests-view";
import { loadPullRequestDetailState, resolveDashboardNavRole } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface PullRequestDetailPageProps {
  params: {
    id: string;
  };
}

export default async function PullRequestDetailPage({ params }: PullRequestDetailPageProps) {
  const [state, role] = await Promise.all([loadPullRequestDetailState(params.id), resolveDashboardNavRole()]);

  return (
    <DashboardShell activeItem="Pull Requests" role={role}>
      <PullRequestDetailView state={state} />
    </DashboardShell>
  );
}
