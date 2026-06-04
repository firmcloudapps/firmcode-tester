import { DeveloperDashboardShell } from "../../../../components/dashboard/developer-dashboard-shell";
import { ReviewRunDetailView } from "../../../../components/dashboard/review-run-detail-view";
import { loadReviewRunDetailState } from "../../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface ReviewRunDetailPageProps {
  params: {
    id: string;
  };
}

export default async function ReviewRunDetailPage({ params }: ReviewRunDetailPageProps) {
  const state = await loadReviewRunDetailState(params.id);

  return (
    <DeveloperDashboardShell activeItem="Review Runs">
      <ReviewRunDetailView state={state} />
    </DeveloperDashboardShell>
  );
}
