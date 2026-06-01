import React from "react";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { SettingsView } from "../../../components/dashboard/settings-view";
import { loadSettingsState } from "../../../lib/dashboard-data";
import { requireAdminDashboardAccess } from "../../../lib/dashboard-guards";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const role = await requireAdminDashboardAccess();
  const state = await loadSettingsState();

  return (
    <DashboardShell activeItem="Settings" role={role}>
      <SettingsView state={state} activeTab="general" />
    </DashboardShell>
  );
}
