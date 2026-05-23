import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { FindingsView } from "../../components/dashboard/findings-view";

export default function FindingsLoading() {
  return (
    <DashboardShell activeItem="Findings">
      <FindingsView state={{ status: "loading" }} />
    </DashboardShell>
  );
}
