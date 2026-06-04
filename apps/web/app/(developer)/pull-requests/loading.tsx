import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { PullRequestsView } from "../../../components/dashboard/pull-requests-view";

export default function PullRequestsLoading() {
  return (
    <DashboardShell activeItem="Pull Requests">
      <PullRequestsView state={{ status: "loading" }} />
    </DashboardShell>
  );
}
