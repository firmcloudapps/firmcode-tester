import { AdminDashboardShell } from "../../../components/dashboard/admin-dashboard-shell";
import { parseSettingsTab, SettingsView } from "../../../components/dashboard/settings-view";
import { loadGitHubAppInstallConfig } from "../../../config/github-app-installation";
import { loadSettingsState } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface SettingsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function SettingsPage({ searchParams = {} }: SettingsPageProps) {
  const state = await loadSettingsState();
  const activeTab = parseSettingsTab(searchParams.tab);
  const installConfig = loadGitHubAppInstallConfig();
  const githubAppInstallUrl = installConfig.status === "configured" ? installConfig.installUrl : null;

  return (
    <AdminDashboardShell activeItem="Settings">
      <SettingsView state={state} activeTab={activeTab} githubAppInstallUrl={githubAppInstallUrl} tabBasePath="/settings" />
    </AdminDashboardShell>
  );
}
