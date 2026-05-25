import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { GitHubInstallationsView } from "../../../components/dashboard/github-installations-view";
import { loadGitHubAppInstallConfig } from "../../../config/github-app-installation";
import { loadGitHubInstallationsState } from "../../../lib/dashboard-data";
import { parseGitHubInstallationsNotice } from "../../../lib/github-installations-notice";

export const dynamic = "force-dynamic";

interface GitHubInstallationsPageProps {
  searchParams?: {
    github_oauth?: string | string[] | undefined;
    github_installation?: string | string[] | undefined;
  };
}

export default async function GitHubInstallationsPage({ searchParams = {} }: GitHubInstallationsPageProps) {
  const state = await loadGitHubInstallationsState();
  const installConfig = loadGitHubAppInstallConfig();
  const notice = parseGitHubInstallationsNotice(searchParams);

  return (
    <DashboardShell activeItem="PR Review">
      <GitHubInstallationsView state={state} installConfig={installConfig} notice={notice} />
    </DashboardShell>
  );
}
