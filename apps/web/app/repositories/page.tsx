import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { RepositoriesView } from "../../components/dashboard/repositories-view";
import { loadRepositoriesState } from "../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface RepositoriesPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function RepositoriesPage({ searchParams = {} }: RepositoriesPageProps) {
  const state = await loadRepositoriesState(searchParams);

  return (
    <DashboardShell activeItem="Repositories">
      <RepositoriesView state={state} />
    </DashboardShell>
  );
}
