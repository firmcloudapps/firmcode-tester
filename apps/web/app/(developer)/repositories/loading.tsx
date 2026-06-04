import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { RepositoriesView } from "../../../components/dashboard/repositories-view";

export default function RepositoriesLoading() {
  return (
    <DashboardShell activeItem="Repositories">
      <RepositoriesView state={{ status: "loading" }} />
    </DashboardShell>
  );
}
