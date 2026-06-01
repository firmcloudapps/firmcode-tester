import React from "react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { BillingView } from "../components/dashboard/billing-view";
import { CiFailuresView } from "../components/dashboard/ci-failures-view";
import { DashboardShell } from "../components/dashboard/dashboard-shell";
import { FindingsView } from "../components/dashboard/findings-view";
import { GitHubInstallationsView } from "../components/dashboard/github-installations-view";
import { OverviewView } from "../components/dashboard/overview-view";
import { PullRequestsView } from "../components/dashboard/pull-requests-view";
import { RepositoriesView } from "../components/dashboard/repositories-view";
import { ReviewRunsView } from "../components/dashboard/review-runs-view";
import { SettingsView } from "../components/dashboard/settings-view";
import { DASHBOARD_NAV_ITEMS } from "../lib/dashboard-navigation";

describe("dashboard visual navigation smoke", () => {
  it("renders the full-width light shell with desktop and mobile navigation states", () => {
    const html = renderToString(
      <DashboardShell activeItem="Review Runs">
        <main>Dashboard body</main>
      </DashboardShell>
    );

    expect(html).toContain("min-h-screen bg-shell text-primary");
    expect(html).toContain("lg:pl-[17rem]");
    expect(html).toContain("lg:pl-64");
    expect(html).toContain('aria-label="Dashboard"');
    expect(html).toContain('aria-label="Mobile dashboard"');
    expect(html).toContain("<details");
    expect(html).toContain("lg:hidden");
    expect(html).toContain("fixed inset-y-0 left-0");

    for (const item of DASHBOARD_NAV_ITEMS) {
      expect(html, item.label).toContain(`href="${item.href}"`);
    }

    expect(countMatches(html, 'href="/review-runs" aria-current="page"')).toBe(2);
    expect(html).not.toContain('aria-disabled="true"');
  });

  it("covers every active dashboard page with route-safe shell rendering", () => {
    const pages = [
      { active: "Overview" as const, expected: "Review operations", view: <OverviewView state={{ status: "loading" }} /> },
      { active: "PR Review" as const, expected: "PR Review", view: <GitHubInstallationsView state={{ status: "loading" }} installConfig={installConfig} /> },
      { active: "Repositories" as const, expected: "Repository review coverage", view: <RepositoriesView state={{ status: "loading" }} /> },
      { active: "Pull Requests" as const, expected: "Engineering review queue", view: <PullRequestsView state={{ status: "loading" }} /> },
      { active: "Review Runs" as const, expected: "Pipeline executions", view: <ReviewRunsView state={{ status: "loading" }} /> },
      { active: "Findings" as const, expected: "Findings inbox", view: <FindingsView state={{ status: "loading" }} /> },
      { active: "CI Failures" as const, expected: "Broken checks queue", view: <CiFailuresView state={{ status: "loading" }} /> },
      { active: "Settings" as const, expected: "Workspace settings", view: <SettingsView state={{ status: "loading" }} activeTab="general" /> },
      { active: "Billing" as const, expected: "Subscription", view: <BillingView state={{ status: "loading" }} billingPortalUrl={null} /> }
    ];

    for (const page of pages) {
      const html = renderToString(<DashboardShell activeItem={page.active}>{page.view}</DashboardShell>);

      expect(html, page.active).toContain('data-clerk-authenticated="required"');
      expect(html, page.active).toContain(page.expected);
      expect(html, page.active).toContain('aria-current="page"');
      expect(html, page.active).not.toContain("404");
      expect(html, page.active).not.toContain("Not Found");
    }
  });

  it("keeps loading, empty, and error states usable for the browser smoke pages", () => {
    const states = [
      renderToString(<OverviewView state={{ status: "error", message: "Dashboard API returned 503" }} />),
      renderToString(<RepositoriesView state={{ status: "empty" }} />),
      renderToString(<ReviewRunsView state={{ status: "empty" }} />),
      renderToString(<FindingsView state={{ status: "empty", data: emptyFindings }} />),
      renderToString(<SettingsView state={{ status: "error", message: "Dashboard API returned 401" }} activeTab="general" />),
      renderToString(<BillingView state={{ status: "error", message: "Dashboard API returned 403" }} billingPortalUrl={null} />),
      renderToString(<PullRequestsView state={{ status: "empty", data: emptyPullRequests }} />),
      renderToString(<CiFailuresView state={{ status: "empty", data: emptyCiFailures }} />)
    ].join("\n");

    expect(states).toContain("Overview could not be loaded");
    expect(states).toContain("No repositories yet");
    expect(states).toContain("No review runs match these filters");
    expect(states).toContain("No findings match these filters");
    expect(states).toContain("Settings could not be loaded");
    expect(states).toContain("Billing could not be loaded");
    expect(states).toContain("No pull requests match these filters");
    expect(states).toContain("No CI failures match these filters");
    expect(states).toContain("disabled=\"\"");
  });

  it("preserves responsive overflow protections for dense dashboard content", () => {
    const files = [
      "components/dashboard/overview-view.tsx",
      "components/dashboard/repositories-view.tsx",
      "components/dashboard/review-runs-view.tsx",
      "components/dashboard/findings-view.tsx",
      "components/dashboard/pull-requests-view.tsx",
      "components/dashboard/ci-failures-view.tsx",
      "components/dashboard/settings-view.tsx"
    ];

    const source = files.map(readWebFile).join("\n");

    expect(source).toContain("overflow-x-auto");
    expect(source).toContain("truncate");
    expect(source).toContain("break-words");
    expect(source).toContain("md:hidden");
    expect(source).toContain("hidden overflow-x-auto md:block");
    expect(source).toContain("min-w-[900px]");
    expect(source).not.toContain("text-[clamp(");
  });

  it("keeps planned controls visibly disabled with accessible titles", () => {
    const html = [
      renderToString(<GitHubInstallationsView state={{ status: "empty", data: syncData }} installConfig={installConfig} />),
      renderToString(<SettingsView state={{ status: "populated", data: developerSettings }} activeTab="api-keys" />),
      renderToString(<BillingView state={{ status: "populated", data: developerBilling }} billingPortalUrl={null} />)
    ].join("\n");

    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain("Planned provider");
    expect(html).toContain("Connect GitHub OAuth before installing the GitHub App.");
    expect(html).toContain("Workspace API key creation is not enabled in the MVP.");
    expect(html).toContain("Admin or Clerk billing permission is required to manage subscriptions.");
    expect(html).toContain("disabled=\"\"");
  });
});

function readWebFile(path: string): string {
  return readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
}

function countMatches(value: string, pattern: string): number {
  return value.split(pattern).length - 1;
}

const installConfig = {
  status: "configured" as const,
  installUrl: "https://github.com/apps/firmcode/installations/new",
  source: "GITHUB_APP_INSTALL_URL" as const
};

const developerSettings = {
  workspace: {
    id: "workspace-1",
    name: "Firmcode",
    clerkOrgId: "org_firmcode",
    role: "developer" as const,
    canManageSensitiveSettings: false
  },
  clerk: {
    userProfileUrl: "https://accounts.clerk.example/user",
    organizationProfileUrl: "https://accounts.clerk.example/organization",
    memberManagementUrl: "https://accounts.clerk.example/members"
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

const syncData = {
  settings: developerSettings,
  oauth: { connected: false, user: null },
  repositories: {
    filters: {},
    repositories: []
  }
};

const developerBilling = {
  workspace: {
    id: "workspace-1",
    role: "developer" as const,
    canManageBilling: false,
    source: "clerk" as const
  },
  plan: {
    name: "Clerk managed",
    status: "managed_by_clerk" as const
  },
  usage: {
    reviewRunsThisMonth: null,
    aiTokensThisMonth: null,
    repositoriesMonitored: null,
    seats: null
  }
};

const emptyFindings = {
  filters: {},
  findings: []
};

const emptyPullRequests = {
  filters: {},
  pagination: {
    limit: 50,
    returned: 0
  },
  pullRequests: []
};

const emptyCiFailures = {
  filters: {},
  pagination: {
    limit: 50,
    returned: 0
  },
  ciFailures: []
};
