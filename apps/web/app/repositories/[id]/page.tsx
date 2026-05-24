import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { RepositoryDetailView, parseRepositoryDetailTab } from "../../../components/dashboard/repository-detail-view";
import { loadRepositoryDetailState } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface RepositoryDetailPageProps {
  params: {
    id: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function RepositoryDetailPage({ params, searchParams = {} }: RepositoryDetailPageProps) {
  const state = await loadRepositoryDetailState(params.id);

  return (
    <DashboardShell activeItem="Repositories">
      <RepositoryDetailView state={state} activeTab={parseRepositoryDetailTab(searchParams.tab)} />
    </DashboardShell>
  );
}
