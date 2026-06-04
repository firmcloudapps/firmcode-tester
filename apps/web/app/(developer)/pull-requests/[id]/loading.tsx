import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { PullRequestDetailView } from "../../../../components/dashboard/pull-requests-view";

export default function PullRequestDetailLoading() {
  return (
    <DashboardShell activeItem="Pull Requests">
      <PullRequestDetailView state={{ status: "loading" }} />
    </DashboardShell>
  );
}
