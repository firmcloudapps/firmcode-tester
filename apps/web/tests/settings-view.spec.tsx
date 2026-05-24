import React from "react";
import { renderToString } from "react-dom/server";
import type { WorkspaceSettingsResponse } from "@firmcode/shared";
import { DashboardShell } from "../components/dashboard/dashboard-shell";
import { parseSettingsTab, SettingsView } from "../components/dashboard/settings-view";

describe("SettingsView", () => {
  it("renders every settings tab and marks the active tab", () => {
    const html = renderToString(<SettingsView state={{ status: "populated", data: ownerSettings }} activeTab="data-retention" />);

    expect(html).toContain("General");
    expect(html).toContain("GitHub App");
    expect(html).toContain("Members");
    expect(html).toContain("API Keys");
    expect(html).toContain("Data Retention");
    expect(html).toContain("Notifications");
    expect(html).toContain('href="/settings?tab=data-retention" aria-current="page"');
  });

  it("normalizes unknown settings tab values to General", () => {
    expect(parseSettingsTab("github-app")).toBe("github-app");
    expect(parseSettingsTab(["members"])).toBe("members");
    expect(parseSettingsTab("surprise")).toBe("general");
    expect(parseSettingsTab(undefined)).toBe("general");
  });

  it("renders loading, empty, and error states for fetched settings data", () => {
    expect(renderToString(<SettingsView state={{ status: "loading" }} activeTab="general" />)).toContain("Loading settings");
    expect(renderToString(<SettingsView state={{ status: "empty", data: emptySettings }} activeTab="github-app" />)).toContain(
      "No GitHub App installation mapped yet"
    );
    expect(renderToString(<SettingsView state={{ status: "error", message: "Dashboard API returned 401" }} activeTab="general" />)).toContain(
      "Settings could not be loaded"
    );
  });

  it("renders populated workspace, GitHub, retention, placeholder, and Clerk delegation content", () => {
    const general = renderToString(<SettingsView state={{ status: "populated", data: ownerSettings }} activeTab="general" />);
    const github = renderToString(<SettingsView state={{ status: "populated", data: ownerSettings }} activeTab="github-app" />);
    const retention = renderToString(<SettingsView state={{ status: "populated", data: ownerSettings }} activeTab="data-retention" />);
    const members = renderToString(<SettingsView state={{ status: "populated", data: ownerSettings }} activeTab="members" />);
    const apiKeys = renderToString(<SettingsView state={{ status: "populated", data: ownerSettings }} activeTab="api-keys" />);
    const notifications = renderToString(<SettingsView state={{ status: "populated", data: ownerSettings }} activeTab="notifications" />);

    expect(general).toContain("Firmcode");
    expect(general).toContain("org_firmcode");
    expect(github).toContain("openclaw");
    expect(github).toContain("review automation enabled");
    expect(retention).toContain("Changed file patches");
    expect(retention).toContain("30 days");
    expect(members).toContain("Open Clerk members");
    expect(apiKeys).toContain("Workspace API key creation is not enabled");
    expect(notifications).toContain("Slack notifications");
  });

  it("keeps settings behind the Clerk-authenticated shell scaffold", () => {
    const html = renderToString(
      <DashboardShell activeItem="Settings">
        <SettingsView state={{ status: "populated", data: ownerSettings }} activeTab="general" />
      </DashboardShell>
    );

    expect(html).toContain('data-clerk-authenticated="required"');
    expect(html).toContain('href="/settings" aria-current="page"');
  });

  it("enables sensitive entry points for owners and disables them for viewers", () => {
    const ownerHtml = renderToString(<SettingsView state={{ status: "populated", data: ownerSettings }} activeTab="github-app" />);
    const viewerHtml = renderToString(<SettingsView state={{ status: "populated", data: viewerSettings }} activeTab="github-app" />);
    const viewerMembers = renderToString(<SettingsView state={{ status: "populated", data: viewerSettings }} activeTab="members" />);

    expect(ownerHtml).toContain("GitHub App connection is not wired");
    expect(ownerHtml).toContain("Sensitive settings enabled");
    expect(viewerHtml).toContain("Read-only sensitive settings");
    expect(viewerHtml).toContain("disabled=\"\"");
    expect(viewerMembers).toContain("Open Clerk members");
    expect(viewerMembers).toContain("disabled=\"\"");
  });
});

const ownerSettings: WorkspaceSettingsResponse = {
  workspace: {
    id: "00000000-0000-4000-8000-000000000101",
    name: "Firmcode",
    clerkOrgId: "org_firmcode",
    role: "owner",
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
    installations: [
      {
        id: "install-1",
        installationId: 301,
        accountLogin: "openclaw",
        accountType: "Organization",
        repositoryCount: 2,
        enabledRepositoryCount: 1,
        updatedAt: "2026-05-22T10:00:00.000Z"
      }
    ]
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

const emptySettings: WorkspaceSettingsResponse = {
  ...ownerSettings,
  githubApp: {
    ...ownerSettings.githubApp,
    installations: []
  }
};

const viewerSettings: WorkspaceSettingsResponse = {
  ...ownerSettings,
  workspace: {
    ...ownerSettings.workspace,
    role: "viewer",
    canManageSensitiveSettings: false
  }
};
