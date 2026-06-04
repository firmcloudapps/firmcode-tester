import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { RepositoryDetailView } from "../../../../components/dashboard/repository-detail-view";

export default function RepositoryDetailLoading() {
  return (
    <DashboardShell activeItem="Repositories">
      <RepositoryDetailView state={{ status: "loading" }} activeTab="overview" />
    </DashboardShell>
  );
}
