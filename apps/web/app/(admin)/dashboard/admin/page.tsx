import React from "react";
import { AdminDashboardShell } from "../../../../components/dashboard/admin-dashboard-shell";
import { SettingsView } from "../../../../components/dashboard/settings-view";
import { loadSettingsState } from "../../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const state = await loadSettingsState();

  return (
    <AdminDashboardShell activeItem="Settings">
      <SettingsView state={state} activeTab="general" tabBasePath="/settings" />
    </AdminDashboardShell>
  );
}
