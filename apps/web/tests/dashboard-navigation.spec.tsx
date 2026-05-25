import React from "react";
import { renderToString } from "react-dom/server";
import { buildOverviewDashboardData } from "../lib/overview-data";
import { DashboardShell } from "../components/dashboard/dashboard-shell";
import { OverviewView } from "../components/dashboard/overview-view";
import { RepositoriesView } from "../components/dashboard/repositories-view";
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

  it("routes repository Configure actions to the implemented repository detail page", () => {
    const html = renderToString(<RepositoriesView state={{ status: "populated", data: repositoryList }} />);

    expect(html).toContain('href="/repositories/repo-1?tab=configuration"');
    expect(html).toContain(">Configure</a>");
    expect(html).not.toContain("Repository detail configuration is planned");
  });

  it("routes Rules / Policies to the implemented dashboard page", () => {
    const html = renderToString(
      <DashboardShell activeItem="Rules">
        <main>Rules body</main>
      </DashboardShell>
    );

    expect(html).toContain('href="/rules"');
    expect(html).toContain(">Rules / Policies</a>");
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain("Rules / Policies</span>");
  });

  it("enables Pull Requests sidebar navigation once the route exists", () => {
    const html = renderToString(
      <DashboardShell activeItem="Pull Requests">
        <main>Pull requests body</main>
      </DashboardShell>
    );

    expect(html).toContain('href="/pull-requests"');
    expect(html).toContain(">Pull Requests</a>");
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain("Pull Requests</span>");
  });

  it("enables CI Failures sidebar navigation once the route exists", () => {
    const html = renderToString(
      <DashboardShell activeItem="CI Failures">
        <main>CI failures body</main>
      </DashboardShell>
    );

    expect(html).toContain('href="/ci-failures"');
    expect(html).toContain(">CI Failures</a>");
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain("CI Failures</span>");
  });

  it("routes overview pull request links to the implemented queue", () => {
    const data = buildOverviewDashboardData({
      repositories: repositoryList.repositories,
      reviewRuns: [],
      now: new Date("2026-05-24T12:00:00.000Z")
    });
    const html = renderToString(<OverviewView state={{ status: "populated", data }} />);

    expect(html).toContain('href="/pull-requests"');
    expect(html).toContain(">Pull requests</a>");
  });

  it("routes overview CI failure needs-attention links to the implemented queue", () => {
    const data = buildOverviewDashboardData({
      repositories: repositoryList.repositories,
      reviewRuns: [],
      now: new Date("2026-05-24T12:00:00.000Z")
    });
    const html = renderToString(<OverviewView state={{ status: "populated", data }} />);

    expect(html).toContain('href="/ci-failures"');
    expect(html).toContain("CI failure");
  });
});

const settings = {
  workspace: {
    id: "workspace-1",
    name: "Firmcode",
    clerkOrgId: "org_firmcode",
    role: "admin" as const,
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

const repositoryList = {
  filters: {},
  repositories: [
    {
      id: "repo-1",
      owner: "openclaw",
      name: "firmcode",
      fullName: "openclaw/firmcode",
      private: false,
      defaultBranch: "main",
      enabled: true,
      primaryLanguage: "TypeScript",
      openFindingsCount: 0,
      lastReview: null,
      updatedAt: "2026-05-22T10:00:00.000Z"
    }
  ]
};
