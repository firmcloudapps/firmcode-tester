import { DeveloperDashboardShell } from "../../../components/dashboard/developer-dashboard-shell";
import { RepositoriesView } from "../../../components/dashboard/repositories-view";

export default function RepositoriesLoading() {
  return (
    <DeveloperDashboardShell activeItem="Repositories">
      <RepositoriesView state={{ status: "loading" }} />
    </DeveloperDashboardShell>
  );
}
