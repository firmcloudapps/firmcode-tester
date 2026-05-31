import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { RepositoriesView } from "../../components/dashboard/repositories-view";
import { loadGitHubRepositoryControlsState, loadRepositoriesState } from "../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface RepositoriesPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function RepositoriesPage({ searchParams = {} }: RepositoriesPageProps) {
  const [state, controlsState] = await Promise.all([
    loadRepositoriesState(searchParams),
    loadGitHubRepositoryControlsState()
  ]);
  const role = controlsState.status === "ready" ? controlsState.data.settings.workspace.role : "developer";

  return (
    <DashboardShell activeItem="Repositories" role={role}>
      <RepositoriesView state={state} controlsState={controlsState} />
    </DashboardShell>
  );
}
