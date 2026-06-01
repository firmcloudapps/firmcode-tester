import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { ReviewRunsView } from "../../components/dashboard/review-runs-view";
import { loadReviewRunsState, resolveDashboardNavRole } from "../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface ReviewRunsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function ReviewRunsPage({ searchParams = {} }: ReviewRunsPageProps) {
  const [state, role] = await Promise.all([loadReviewRunsState(searchParams), resolveDashboardNavRole()]);

  return (
    <DashboardShell activeItem="Review Runs" role={role}>
      <ReviewRunsView state={state} />
    </DashboardShell>
  );
}
