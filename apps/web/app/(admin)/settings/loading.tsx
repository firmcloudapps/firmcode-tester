import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { SettingsView } from "../../../components/dashboard/settings-view";

export default function SettingsLoading() {
  return (
    <DashboardShell activeItem="Settings">
      <SettingsView state={{ status: "loading" }} activeTab="general" />
    </DashboardShell>
  );
}
