import React from "react";
import { renderToString } from "react-dom/server";
import type { WorkspaceSettingsResponse } from "@firmcode/shared";
import { DashboardShell } from "../components/dashboard/dashboard-shell";
import { GitHubInstallationsView } from "../components/dashboard/github-installations-view";

describe("GitHubInstallationsView", () => {
  it("renders the signed-out state without enabling installation", () => {
    const html = renderToString(
      <GitHubInstallationsView
        state={{ status: "signed-out" }}
        installConfig={{
          status: "configured",
          installUrl: "https://github.com/apps/firmcode/installations/new",
          source: "GITHUB_APP_INSTALL_URL"
        }}
      />
    );

    expect(html).toContain("Sign in is required");
    expect(html).toContain("Install GitHub App");
    expect(html).toContain("disabled=\"\"");
  });

  it("renders signed-in setup status with no installation and a configured install URL", () => {
    const html = renderToString(
      <GitHubInstallationsView
        state={{ status: "empty", data: emptySettings }}
        installConfig={{
          status: "configured",
          installUrl: "https://github.com/apps/firmcode/installations/new",
          source: "GITHUB_APP_INSTALL_URL"
        }}
      />
    );

    expect(html).toContain("No installation mapped");
    expect(html).toContain("No installation is mapped to this workspace yet");
    expect(html).toContain("Configured install URL");
    expect(html).toContain("https://github.com/apps/firmcode/installations/new");
    expect(html).toContain('href="https://github.com/apps/firmcode/installations/new"');
  });

  it("renders connected installations", () => {
    const html = renderToString(
      <GitHubInstallationsView
        state={{ status: "populated", data: ownerSettings }}
        installConfig={{
          status: "configured",
          installUrl: "https://github.com/apps/firmcode/installations/new",
          source: "GITHUB_APP_INSTALL_URL"
        }}
      />
    );

    expect(html).toContain("Installation mapped");
    expect(html).toContain("openclaw");
    expect(html).toContain("repositories have review automation enabled");
    expect(html).toContain("installation:<!-- -->301");
  });

  it("renders missing install config as a disabled setup state", () => {
    const html = renderToString(
      <GitHubInstallationsView
        state={{ status: "empty", data: emptySettings }}
        installConfig={{
          status: "missing",
          required: ["GITHUB_APP_INSTALL_URL", "GITHUB_APP_SLUG"]
        }}
      />
    );

    expect(html).toContain("Missing GitHub App install config");
    expect(html).toContain("Install URL not configured");
    expect(html).toContain("API-side GitHub App credentials remain server-only");
    expect(html).not.toContain("GITHUB_APP_PRIVATE_KEY");
    expect(html).not.toContain("GITHUB_WEBHOOK_SECRET");
    expect(html).not.toContain("GITHUB_CLIENT_SECRET");
    expect(html).not.toContain("installation token");
  });

  it("renders safe API error and retry state", () => {
    const html = renderToString(
      <GitHubInstallationsView
        state={{ status: "error", message: "Dashboard API returned 503" }}
        installConfig={{
          status: "configured",
          installUrl: "https://github.com/apps/firmcode/installations/new",
          source: "GITHUB_APP_INSTALL_URL"
        }}
      />
    );

    expect(html).toContain("Installation status could not be loaded");
    expect(html).toContain("Dashboard API returned 503");
    expect(html).toContain('href="/github/installations"');
  });

  it("keeps the route inside the Clerk-authenticated dashboard shell", () => {
    const html = renderToString(
      <DashboardShell activeItem="PR Review">
        <GitHubInstallationsView
          state={{ status: "empty", data: emptySettings }}
          installConfig={{
            status: "configured",
            installUrl: "https://github.com/apps/firmcode/installations/new",
            source: "GITHUB_APP_INSTALL_URL"
          }}
        />
      </DashboardShell>
    );

    expect(html).toContain('data-clerk-authenticated="required"');
    expect(html).toContain('href="/github/installations" aria-current="page"');
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
