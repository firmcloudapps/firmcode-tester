import { DeveloperDashboardShell } from "../../../components/dashboard/developer-dashboard-shell";
import { PullRequestsView } from "../../../components/dashboard/pull-requests-view";
import { loadPullRequestsState } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface PullRequestsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function PullRequestsPage({ searchParams = {} }: PullRequestsPageProps) {
  const state = await loadPullRequestsState(searchParams);

  return (
    <DeveloperDashboardShell activeItem="Pull Requests">
      <PullRequestsView state={state} />
    </DeveloperDashboardShell>
  );
}
