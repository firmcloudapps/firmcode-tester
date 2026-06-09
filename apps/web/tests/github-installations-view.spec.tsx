import React from "react";
import { renderToString } from "react-dom/server";
import type { RepositoryListResponse, WorkspaceSettingsResponse } from "@firmcode/shared";
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
    expect(html).toContain("Connect GitHub");
    expect(html).toContain("disabled=\"\"");
  });

  it("renders missing OAuth as compact developer actions and disables GitHub-backed controls", () => {
    const html = renderToString(
      <GitHubInstallationsView
        state={{ status: "empty", data: syncData(emptySettings, false) }}
        installConfig={{
          status: "configured",
          installUrl: "https://github.com/apps/firmcode/installations/new",
          source: "GITHUB_APP_INSTALL_URL"
        }}
      />
    );

    expect(html).not.toContain("GitHub account");
    expect(html).not.toContain("GitHub connection status");
    expect(html).toContain('href="/auth/github"');
    expect(html).toContain("GitHub App");
    expect(html).toContain("Connect GitHub before installing the GitHub App.");
    expect(html).toContain("Connect GitHub before syncing repositories.");
    expect(html).toContain("Needs account");
    expect(html).not.toContain("Setup order");
  });

  it("renders signed-in developer setup as compact header actions", () => {
    const html = renderToString(
      <GitHubInstallationsView
        state={{ status: "empty", data: syncData(emptySettings, true) }}
        installConfig={{
          status: "configured",
          installUrl: "https://github.com/apps/firmcode/installations/new",
          source: "GITHUB_APP_INSTALL_URL"
        }}
      />
    );

    expect(html).toContain("GitHub connected");
    expect(html).toContain("GitHub App");
    expect(html).not.toContain("GitHub account");
    expect(html).not.toContain("kelly");
    expect(html).not.toContain("Missing");
    expect(html).not.toContain("No repositories have been granted yet");
    expect(html).not.toContain("Refresh app status");
    expect(html).not.toContain('href="/auth/github"');
    expect(html).not.toContain("Configured install URL");
    expect(html).toContain('href="https://github.com/apps/firmcode/installations/new"');
  });

  it("renders connected installations", () => {
    const html = renderToString(
      <GitHubInstallationsView
        state={{ status: "populated", data: syncData(developerSettings, true) }}
        installConfig={{
          status: "configured",
          installUrl: "https://github.com/apps/firmcode/installations/new",
          source: "GITHUB_APP_INSTALL_URL"
        }}
      />
    );

    expect(html).toContain("GitHub App installed");
    expect(html).toContain("openclaw/firmcode");
    expect(html).not.toContain("repositories have review automation enabled");
    expect(html).not.toContain("installation:<!-- -->301");
  });

  it("keeps setup status cards available for admin roles", () => {
    const html = renderToString(
      <GitHubInstallationsView
        state={{ status: "empty", data: syncData(adminSettings, false) }}
        installConfig={{
          status: "configured",
          installUrl: "https://github.com/apps/firmcode/installations/new",
          source: "GITHUB_APP_INSTALL_URL"
        }}
      />
    );

    expect(html).toContain("GitHub account");
    expect(html).toContain("GitHub App");
    expect(html).toContain("Connect GitHub first");
    expect(html).toContain("GitHub connection status");
  });

  it("renders a minimal repository review list without provider tabs", () => {
    const html = renderToString(
      <GitHubInstallationsView
        state={{ status: "populated", data: syncData(developerSettings, true) }}
        installConfig={{
          status: "configured",
          installUrl: "https://github.com/apps/firmcode/installations/new",
          source: "GITHUB_APP_INSTALL_URL"
        }}
      />
    );

    expect(html).not.toContain("Review providers");
    expect(html).not.toContain("GitLab");
    expect(html).not.toContain("Bitbucket");
    expect(html).not.toContain("Azure DevOps");
    expect(html).toContain("Repositories");
    expect(html).toContain("openclaw/firmcode");
    expect(html).toContain("Ready");
    expect(html).toContain("Configure");
    expect(html).toContain('href="/repositories/00000000-0000-4000-8000-000000000201?tab=configuration"');
    expect(html).toContain("Run");
    expect(html).not.toContain("Developer");
  });

  it("does not render setup instructions or admin install details for developers", () => {
    const html = renderToString(
      <GitHubInstallationsView
        state={{ status: "populated", data: syncData(developerSettings, true) }}
        installConfig={{
          status: "configured",
          installUrl: "https://github.com/apps/firmcode/installations/new",
          source: "GITHUB_APP_INSTALL_URL"
        }}
      />
    );

    expect(html).not.toContain("GitHub setup instructions");
    expect(html).not.toContain("Setup order");
    expect(html).not.toContain("Configured install URL");
    expect(html).not.toContain("workspace admins");
  });

  it("renders OAuth callback success and retry error notices without raw payloads", () => {
    const successHtml = renderToString(
      <GitHubInstallationsView
        state={{ status: "empty", data: syncData(emptySettings, true) }}
        installConfig={{
          status: "configured",
          installUrl: "https://github.com/apps/firmcode/installations/new",
          source: "GITHUB_APP_INSTALL_URL"
        }}
        notice="oauth-connected"
      />
    );
    const errorHtml = renderToString(
      <GitHubInstallationsView
        state={{ status: "empty", data: syncData(emptySettings, false) }}
        installConfig={{
          status: "configured",
          installUrl: "https://github.com/apps/firmcode/installations/new",
          source: "GITHUB_APP_INSTALL_URL"
        }}
        notice="oauth-error"
      />
    );

    expect(successHtml).toContain("GitHub account connected");
    expect(errorHtml).toContain("GitHub OAuth did not complete");
    expect(errorHtml).toContain("Retry the GitHub account connection");
    expect(`${successHtml}\n${errorHtml}`).not.toContain("oauth-code");
    expect(`${successHtml}\n${errorHtml}`).not.toContain("oauth-state");
    expect(`${successHtml}\n${errorHtml}`).not.toContain("access_token");
  });

  it("hides missing install config details from the developer setup state", () => {
    const html = renderToString(
      <GitHubInstallationsView
        state={{ status: "empty", data: syncData(emptySettings, true) }}
        installConfig={{
          status: "missing",
          required: ["GITHUB_APP_INSTALL_URL", "GITHUB_APP_SLUG"]
        }}
      />
    );

    expect(html).toContain("Set GITHUB_APP_INSTALL_URL or GITHUB_APP_SLUG before installing the GitHub App.");
    expect(html).not.toContain("Missing GitHub App install config");
    expect(html).not.toContain("API-side GitHub App credentials remain server-only");
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

    expect(html).toContain("GitHub status could not be loaded");
    expect(html).toContain("Dashboard API returned 503");
    expect(html).toContain('href="/github/installations"');
  });

  it("renders developer installation and sync states", () => {
    const html = renderToString(
      <GitHubInstallationsView
        state={{ status: "populated", data: syncData(readOnlyDeveloperSettings, true) }}
        installConfig={{
          status: "configured",
          installUrl: "https://github.com/apps/firmcode/installations/new",
          source: "GITHUB_APP_INSTALL_URL"
        }}
      />
    );

    expect(html).toContain("GitHub connected");
    expect(html).toContain("Sync GitHub");
    expect(html).toContain("Configure");
    expect(html).not.toContain('href="https://github.com/apps/firmcode/installations/new"');
  });

  it("keeps the route inside the authenticated dashboard shell", () => {
    const html = renderToString(
      <DashboardShell activeItem="PR Review">
        <GitHubInstallationsView
          state={{ status: "empty", data: syncData(emptySettings, true) }}
          installConfig={{
            status: "configured",
            installUrl: "https://github.com/apps/firmcode/installations/new",
            source: "GITHUB_APP_INSTALL_URL"
          }}
        />
      </DashboardShell>
    );

    expect(html).toContain('data-authenticated="required"');
    expect(html).toContain('href="/dashboard/developer" aria-current="page"');
  });
});

const developerSettings: WorkspaceSettingsResponse = {
  workspace: {
    id: "00000000-0000-4000-8000-000000000101",
    name: "Firmcode",
    identityWorkspaceId: "org_firmcode",
    role: "developer",
    canManageSensitiveSettings: false
  },
  identity: {
    userProfileUrl: "/user-profile",
    workspaceProfileUrl: "/organization-profile",
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
  ...developerSettings,
  githubApp: {
    ...developerSettings.githubApp,
    installations: []
  }
};

const adminSettings: WorkspaceSettingsResponse = {
  ...developerSettings,
  workspace: {
    ...developerSettings.workspace,
    role: "admin",
    canManageSensitiveSettings: true
  },
  githubApp: {
    ...developerSettings.githubApp,
    installations: []
  }
};

const readOnlyDeveloperSettings: WorkspaceSettingsResponse = {
  ...developerSettings,
  workspace: {
    ...developerSettings.workspace,
    role: "developer",
    canManageSensitiveSettings: false
  }
};

const repositories: RepositoryListResponse = {
  filters: {},
  repositories: [
    {
      id: "00000000-0000-4000-8000-000000000201",
      owner: "openclaw",
      name: "firmcode",
      fullName: "openclaw/firmcode",
      private: false,
      defaultBranch: "main",
      enabled: true,
      primaryLanguage: "TypeScript",
      openFindingsCount: 1,
      updatedAt: "2026-05-22T10:00:00.000Z",
      lastReview: {
        reviewRunId: "00000000-0000-4000-8000-000000000301",
        pullRequestNumber: 7,
        pullRequestTitle: "Add sync UI",
        status: "succeeded",
        headSha: "abc123def456",
        createdAt: "2026-05-22T10:00:00.000Z",
        finishedAt: "2026-05-22T10:02:00.000Z"
      }
    }
  ]
};

function syncData(settings: WorkspaceSettingsResponse, oauthConnected: boolean) {
  return {
    settings,
    oauth: oauthConnected
      ? {
          connected: true,
          user: {
            githubUserId: 42,
            login: "kelly",
            name: "Kelly",
            avatarUrl: null,
            connectedAt: "2026-05-22T09:00:00.000Z",
            updatedAt: "2026-05-22T09:00:00.000Z"
          }
        }
      : {
          connected: false,
          user: null
        },
    repositories
  };
}
