import React from "react";
import { DeveloperDashboardShell } from "../../../../components/dashboard/developer-dashboard-shell";
import { DeveloperPrReviewDashboard } from "../../../../components/dashboard/developer-pr-review-dashboard";
import { loadGitHubAppInstallConfig } from "../../../../config/github-app-installation";
import { loadDeveloperPrReviewState } from "../../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function DeveloperDashboardPage() {
  const state = (await loadDeveloperPrReviewState()) as React.ComponentProps<typeof DeveloperPrReviewDashboard>["state"];
  const installConfig = loadGitHubAppInstallConfig();

  return (
    <DeveloperDashboardShell activeItem="PR Review">
      <DeveloperPrReviewDashboard state={state} installConfig={installConfig} />
    </DeveloperDashboardShell>
  );
}
