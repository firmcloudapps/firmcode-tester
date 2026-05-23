import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { ReviewRunsView } from "../../components/dashboard/review-runs-view";
import { loadReviewRunsState } from "../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface ReviewRunsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function ReviewRunsPage({ searchParams = {} }: ReviewRunsPageProps) {
  const state = await loadReviewRunsState(searchParams);

  return (
    <DashboardShell activeItem="Review Runs">
      <ReviewRunsView state={state} />
    </DashboardShell>
  );
}
