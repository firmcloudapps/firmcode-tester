import { DeveloperDashboardShell } from "../../../../components/dashboard/developer-dashboard-shell";
import { PullRequestDetailView } from "../../../../components/dashboard/pull-requests-view";

export default function PullRequestDetailLoading() {
  return (
    <DeveloperDashboardShell activeItem="Pull Requests">
      <PullRequestDetailView state={{ status: "loading" }} />
    </DeveloperDashboardShell>
  );
}
