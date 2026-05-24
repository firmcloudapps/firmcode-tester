import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { GitHubInstallationsView } from "../../../components/dashboard/github-installations-view";
import { loadGitHubAppInstallConfig } from "../../../config/github-app-installation";
import { loadGitHubInstallationsState } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function GitHubInstallationsPage() {
  const state = await loadGitHubInstallationsState();
  const installConfig = loadGitHubAppInstallConfig();

  return (
    <DashboardShell activeItem="PR Review">
      <GitHubInstallationsView state={state} installConfig={installConfig} />
    </DashboardShell>
  );
}
