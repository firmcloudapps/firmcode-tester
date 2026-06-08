import { DeveloperDashboardShell } from "../../../../components/dashboard/developer-dashboard-shell";
import { ReviewRunDetailView } from "../../../../components/dashboard/review-run-detail-view";

export default function ReviewRunDetailLoading() {
  return (
    <DeveloperDashboardShell activeItem="Review Runs">
      <ReviewRunDetailView state={{ status: "loading" }} />
    </DeveloperDashboardShell>
  );
}
