import { DeveloperDashboardShell } from "../../../components/dashboard/developer-dashboard-shell";
import { FindingsView } from "../../../components/dashboard/findings-view";

export default function FindingsLoading() {
  return (
    <DeveloperDashboardShell activeItem="Findings">
      <FindingsView state={{ status: "loading" }} />
    </DeveloperDashboardShell>
  );
}
