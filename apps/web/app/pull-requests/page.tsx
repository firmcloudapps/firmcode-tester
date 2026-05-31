import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { PullRequestsView } from "../../components/dashboard/pull-requests-view";
import { loadPullRequestsState, resolveDashboardNavRole } from "../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface PullRequestsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function PullRequestsPage({ searchParams = {} }: PullRequestsPageProps) {
  const [state, role] = await Promise.all([loadPullRequestsState(searchParams), resolveDashboardNavRole()]);

  return (
    <DashboardShell activeItem="Pull Requests" role={role}>
      <PullRequestsView state={state} />
    </DashboardShell>
  );
}
