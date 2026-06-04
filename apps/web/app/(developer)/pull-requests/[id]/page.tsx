import { DeveloperDashboardShell } from "../../../../components/dashboard/developer-dashboard-shell";
import { PullRequestDetailView } from "../../../../components/dashboard/pull-requests-view";
import { loadPullRequestDetailState } from "../../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface PullRequestDetailPageProps {
  params: {
    id: string;
  };
}

export default async function PullRequestDetailPage({ params }: PullRequestDetailPageProps) {
  const state = await loadPullRequestDetailState(params.id);

  return (
    <DeveloperDashboardShell activeItem="Pull Requests">
      <PullRequestDetailView state={state} />
    </DeveloperDashboardShell>
  );
}
