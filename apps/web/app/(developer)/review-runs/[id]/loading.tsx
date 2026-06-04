import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { ReviewRunDetailView } from "../../../components/dashboard/review-run-detail-view";

export default function ReviewRunDetailLoading() {
  return (
    <DashboardShell activeItem="Review Runs">
      <ReviewRunDetailView state={{ status: "loading" }} />
    </DashboardShell>
  );
}
