import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { ReviewRunsView } from "../../../components/dashboard/review-runs-view";

export default function ReviewRunsLoading() {
  return (
    <DashboardShell activeItem="Review Runs">
      <ReviewRunsView state={{ status: "loading" }} />
    </DashboardShell>
  );
}
