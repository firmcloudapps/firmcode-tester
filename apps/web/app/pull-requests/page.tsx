import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { PullRequestsView } from "../../components/dashboard/pull-requests-view";
import { loadPullRequestsState } from "../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface PullRequestsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function PullRequestsPage({ searchParams = {} }: PullRequestsPageProps) {
  const state = await loadPullRequestsState(searchParams);

  return (
    <DashboardShell activeItem="Pull Requests">
      <PullRequestsView state={state} />
    </DashboardShell>
  );
}
