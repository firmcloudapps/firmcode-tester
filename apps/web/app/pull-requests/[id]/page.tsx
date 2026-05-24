import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { PullRequestDetailView } from "../../../components/dashboard/pull-requests-view";
import { loadPullRequestDetailState } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface PullRequestDetailPageProps {
  params: {
    id: string;
  };
}

export default async function PullRequestDetailPage({ params }: PullRequestDetailPageProps) {
  const state = await loadPullRequestDetailState(params.id);

  return (
    <DashboardShell activeItem="Pull Requests">
      <PullRequestDetailView state={state} />
    </DashboardShell>
  );
}
