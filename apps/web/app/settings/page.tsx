import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { parseSettingsTab, SettingsView } from "../../components/dashboard/settings-view";
import { loadGitHubAppInstallConfig } from "../../config/github-app-installation";
import { loadSettingsState } from "../../lib/dashboard-data";
import { requireAdminDashboardAccess } from "../../lib/dashboard-guards";

export const dynamic = "force-dynamic";

interface SettingsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function SettingsPage({ searchParams = {} }: SettingsPageProps) {
  const role = await requireAdminDashboardAccess();
  const state = await loadSettingsState();
  const activeTab = parseSettingsTab(searchParams.tab);
  const installConfig = loadGitHubAppInstallConfig();
  const githubAppInstallUrl = installConfig.status === "configured" ? installConfig.installUrl : null;

  return (
    <DashboardShell activeItem="Settings" role={role}>
      <SettingsView state={state} activeTab={activeTab} githubAppInstallUrl={githubAppInstallUrl} />
    </DashboardShell>
  );
}
