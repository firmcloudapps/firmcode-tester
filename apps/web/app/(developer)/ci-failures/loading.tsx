import { DeveloperDashboardShell } from "../../../components/dashboard/developer-dashboard-shell";
import { CiFailuresView } from "../../../components/dashboard/ci-failures-view";

export default function CiFailuresLoading() {
  return (
    <DeveloperDashboardShell activeItem="CI Failures">
      <CiFailuresView state={{ status: "loading" }} />
    </DeveloperDashboardShell>
  );
}
