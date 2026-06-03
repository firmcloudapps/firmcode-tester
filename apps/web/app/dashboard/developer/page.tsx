import React from "react";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { DeveloperPrReviewDashboard } from "../../../components/dashboard/developer-pr-review-dashboard";
import { loadGitHubAppInstallConfig } from "../../../config/github-app-installation";
import { loadDeveloperPrReviewState } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function DeveloperDashboardPage() {
  const state = (await loadDeveloperPrReviewState()) as React.ComponentProps<typeof DeveloperPrReviewDashboard>["state"];
  const installConfig = loadGitHubAppInstallConfig();
  const role = state.status === "empty" || state.status === "populated" ? state.data.settings.workspace.role : "developer";

  return (
    <DashboardShell activeItem="PR Review" role={role}>
      <DeveloperPrReviewDashboard state={state} installConfig={installConfig} />
    </DashboardShell>
  );
}
