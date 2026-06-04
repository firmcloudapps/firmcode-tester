import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { CiFailureDetailView } from "../../../../components/dashboard/ci-failures-view";

export default function CiFailureDetailLoading() {
  return (
    <DashboardShell activeItem="CI Failures">
      <CiFailureDetailView state={{ status: "loading" }} />
    </DashboardShell>
  );
}
