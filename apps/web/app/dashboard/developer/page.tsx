import React from "react";
import { DeveloperPrReviewDashboard } from "../../../components/dashboard/developer-pr-review-dashboard";
import { loadGitHubAppInstallConfig } from "../../../config/github-app-installation";
import { loadGitHubInstallationsState } from "../../../lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function DeveloperDashboardPage() {
  const state = await loadGitHubInstallationsState();
  const installConfig = loadGitHubAppInstallConfig();

  return <DeveloperPrReviewDashboard state={state} installConfig={installConfig} />;
}
