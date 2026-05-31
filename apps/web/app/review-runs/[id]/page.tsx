import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { ReviewRunDetailView } from "../../../components/dashboard/review-run-detail-view";
import { loadReviewRunDetailState, resolveDashboardNavRole } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface ReviewRunDetailPageProps {
  params: {
    id: string;
  };
}

export default async function ReviewRunDetailPage({ params }: ReviewRunDetailPageProps) {
  const [state, role] = await Promise.all([loadReviewRunDetailState(params.id), resolveDashboardNavRole()]);

  return (
    <DashboardShell activeItem="Review Runs" role={role}>
      <ReviewRunDetailView state={state} />
    </DashboardShell>
  );
}
