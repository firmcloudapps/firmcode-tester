import { AdminDashboardShell } from "../../../components/dashboard/admin-dashboard-shell";
import { SettingsView } from "../../../components/dashboard/settings-view";

export default function SettingsLoading() {
  return (
    <AdminDashboardShell activeItem="Settings">
      <SettingsView state={{ status: "loading" }} activeTab="general" />
    </AdminDashboardShell>
  );
}
