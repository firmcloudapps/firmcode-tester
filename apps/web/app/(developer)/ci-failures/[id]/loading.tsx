import { DeveloperDashboardShell } from "../../../../components/dashboard/developer-dashboard-shell";
import { CiFailureDetailView } from "../../../../components/dashboard/ci-failures-view";

export default function CiFailureDetailLoading() {
  return (
    <DeveloperDashboardShell activeItem="CI Failures">
      <CiFailureDetailView state={{ status: "loading" }} />
    </DeveloperDashboardShell>
  );
}
