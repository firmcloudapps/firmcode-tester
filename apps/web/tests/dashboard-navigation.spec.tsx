import React from "react";
import { renderToString } from "react-dom/server";
import { DashboardShell } from "../components/dashboard/dashboard-shell";
import { SettingsView } from "../components/dashboard/settings-view";

describe("dashboard navigation", () => {
  it("routes Connect GitHub and PR Review to the implemented installation workspace", () => {
    const html = renderToString(
      <DashboardShell activeItem="Overview">
        <main>Dashboard body</main>
      </DashboardShell>
    );

    expect(html).toContain('href="/github/installations"');
    expect(html).toContain(">Connect GitHub</a>");
    expect(html).toContain(">PR Review</a>");
    expect(html).not.toContain("GitHub App connection is not wired");
  });

  it("routes the settings GitHub App action to the implemented installation workspace for admins", () => {
    const html = renderToString(<SettingsView state={{ status: "populated", data: settings }} activeTab="github-app" />);

    expect(html).toContain('href="/github/installations"');
    expect(html).toContain(">Connect GitHub App</a>");
  });
});

const settings = {
  workspace: {
    id: "workspace-1",
    name: "Firmcode",
    clerkOrgId: "org_firmcode",
    role: "owner" as const,
    canManageSensitiveSettings: true
  },
  clerk: {
    userProfileUrl: "/user-profile",
    organizationProfileUrl: "/organization-profile",
    memberManagementUrl: "/organization-profile/members"
  },
  githubApp: {
    installUrl: "/github/installations",
    repositoryConfigurationUrl: "/repositories",
    installations: []
  },
  retention: {
    artifactRetentionDays: 30,
    changedFilePatchDays: 30,
    fullSnapshotDays: 14,
    ciLogDays: 14,
    llmArtifactDays: 14,
    semgrepArtifactDays: 30,
    treeSitterArtifactDays: 30,
    findingMetadataDays: 180,
    aggregatedMetricDays: 365
  },
  apiKeys: {
    enabled: false,
    message: "Workspace API key creation is not enabled in the MVP."
  },
  notifications: {
    enabled: false,
    message: "Email and Slack notification routing is planned after review delivery stabilizes."
  }
};
