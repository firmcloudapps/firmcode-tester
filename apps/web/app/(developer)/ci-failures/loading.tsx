import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { CiFailuresView } from "../../components/dashboard/ci-failures-view";

export default function CiFailuresLoading() {
  return (
    <DashboardShell activeItem="CI Failures">
      <CiFailuresView state={{ status: "loading" }} />
    </DashboardShell>
  );
}
