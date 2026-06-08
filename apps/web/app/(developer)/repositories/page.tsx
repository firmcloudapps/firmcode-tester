import { DeveloperDashboardShell } from "../../../components/dashboard/developer-dashboard-shell";
import { RepositoriesView } from "../../../components/dashboard/repositories-view";
import { loadGitHubRepositoryControlsState, loadRepositoriesState } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface RepositoriesPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function RepositoriesPage({ searchParams = {} }: RepositoriesPageProps) {
  const [state, controlsState] = await Promise.all([
    loadRepositoriesState(searchParams),
    loadGitHubRepositoryControlsState()
  ]);

  return (
    <DeveloperDashboardShell activeItem="Repositories">
      <RepositoriesView state={state} controlsState={controlsState} />
    </DeveloperDashboardShell>
  );
}
