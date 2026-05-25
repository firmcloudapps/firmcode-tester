import React from "react";
import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { SettingsView } from "../../components/dashboard/settings-view";
import { loadSettingsState } from "../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const state = await loadSettingsState();

  return (
    <DashboardShell activeItem="Settings">
      <SettingsView state={state} activeTab="general" />
    </DashboardShell>
  );
}
