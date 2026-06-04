import { DeveloperDashboardShell } from "../../../../components/dashboard/developer-dashboard-shell";
import { RepositoryDetailView } from "../../../../components/dashboard/repository-detail-view";

export default function RepositoryDetailLoading() {
  return (
    <DeveloperDashboardShell activeItem="Repositories">
      <RepositoryDetailView state={{ status: "loading" }} activeTab="overview" />
    </DeveloperDashboardShell>
  );
}
