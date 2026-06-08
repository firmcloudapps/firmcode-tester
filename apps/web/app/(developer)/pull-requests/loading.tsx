import { DeveloperDashboardShell } from "../../../components/dashboard/developer-dashboard-shell";
import { PullRequestsView } from "../../../components/dashboard/pull-requests-view";

export default function PullRequestsLoading() {
  return (
    <DeveloperDashboardShell activeItem="Pull Requests">
      <PullRequestsView state={{ status: "loading" }} />
    </DeveloperDashboardShell>
  );
}
