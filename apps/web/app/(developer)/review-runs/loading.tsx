import { DeveloperDashboardShell } from "../../../components/dashboard/developer-dashboard-shell";
import { ReviewRunsView } from "../../../components/dashboard/review-runs-view";

export default function ReviewRunsLoading() {
  return (
    <DeveloperDashboardShell activeItem="Review Runs">
      <ReviewRunsView state={{ status: "loading" }} />
    </DeveloperDashboardShell>
  );
}
