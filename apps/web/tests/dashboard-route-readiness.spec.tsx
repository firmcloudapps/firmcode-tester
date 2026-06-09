import React from "react";
import { readdirSync } from "node:fs";
import { relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import type {
  OverviewSupplementData,
  RepositoryListResponse,
  ReviewRunListItem,
  WorkspaceBillingResponse,
  WorkspaceSettingsResponse
} from "@firmcode/shared";
import { BillingView } from "../components/dashboard/billing-view";
import { DashboardShell } from "../components/dashboard/dashboard-shell";
import { GitHubInstallationsView } from "../components/dashboard/github-installations-view";
import { OverviewView } from "../components/dashboard/overview-view";
import { RepositoriesView } from "../components/dashboard/repositories-view";
import { SettingsView } from "../components/dashboard/settings-view";
import { DASHBOARD_ROUTE_ACTIONS } from "../lib/dashboard-action-manifest";
import { buildOverviewDashboardData } from "../lib/overview-data";
import {
  DASHBOARD_IMPLEMENTED_ROUTE_PATTERNS,
  classifyDashboardDestination,
  isAllowedExternalDashboardUrl,
  isImplementedDashboardRoute
} from "../lib/dashboard-route-readiness";

describe("dashboard route readiness guard", () => {
  it("keeps the implemented route manifest in sync with the Next app route tree", () => {
    const actualRoutes = discoverNextRoutes();

    for (const route of DASHBOARD_IMPLEMENTED_ROUTE_PATTERNS) {
      expect(actualRoutes).toContain(route.pattern);
    }
  });

  it("does not register duplicate normalized Next routes", () => {
    const actualRoutes = discoverNextRoutes();
    const duplicates = actualRoutes.filter((route, index) => actualRoutes.indexOf(route) !== index);

    expect(duplicates).toEqual([]);
  });

  it("requires every active internal navigation or action definition to target an implemented route", () => {
    const activeInternalActions = DASHBOARD_ROUTE_ACTIONS.filter(
      (action) => action.status === "active" && action.destination === "internal"
    );

    expect(activeInternalActions.length).toBeGreaterThan(0);

    for (const action of activeInternalActions) {
      expect(action.href, `${action.surface}:${action.label}`).toBeDefined();
      expect(isImplementedDashboardRoute(action.href!), `${action.surface}:${action.label} -> ${action.href}`).toBe(true);
    }
  });

  it("keeps external InsForge and GitHub actions explicit and validates them separately", () => {
    const externalActions = DASHBOARD_ROUTE_ACTIONS.filter((action) => action.destination === "external");

    expect(externalActions.length).toBeGreaterThan(0);

    for (const action of externalActions) {
      expect(action.provider, `${action.surface}:${action.label}`).toBeDefined();
      expect(action.href, `${action.surface}:${action.label}`).toBeDefined();
      expect(
        isAllowedExternalDashboardUrl(action.href!, action.provider!),
        `${action.surface}:${action.label} -> ${action.href}`
      ).toBe(true);
    }
  });

  it("requires planned dashboard actions to stay disabled and accessible", () => {
    const plannedActions = DASHBOARD_ROUTE_ACTIONS.filter((action) => action.status === "planned-disabled");

    expect(plannedActions.length).toBeGreaterThan(0);

    for (const action of plannedActions) {
      expect(action.href, `${action.surface}:${action.label}`).toBeUndefined();
      expect(action.title, `${action.surface}:${action.label}`).toEqual(expect.any(String));
    }
  });

  it("validates rendered sidebar, topbar, overview, repository, settings, billing, and GitHub setup links", () => {
    const html = [
      renderToString(
        <DashboardShell activeItem="Overview">
          <main>Dashboard body</main>
        </DashboardShell>
      ),
      renderToString(<OverviewView state={{ status: "populated", data: overviewData }} />),
      renderToString(
        <RepositoriesView
          state={{ status: "populated", data: repositoryList }}
          controlsState={{
            status: "ready",
            data: {
              oauth: connectedOAuth,
              settings: externalSettings
            }
          }}
        />
      ),
      renderToString(<SettingsView state={{ status: "populated", data: externalSettings }} activeTab="general" />),
      renderToString(<SettingsView state={{ status: "populated", data: externalSettings }} activeTab="github-app" />),
      renderToString(<SettingsView state={{ status: "populated", data: externalSettings }} activeTab="members" />),
      renderToString(
        <BillingView
          state={{ status: "populated", data: billing }}
          billingPortalUrl="https://accounts.identity.example/billing"
        />
      ),
      renderToString(
        <GitHubInstallationsView
          state={{ status: "populated", data: syncData(externalSettings, true) }}
          installConfig={{
            status: "configured",
            installUrl: "https://github.com/apps/firmcode/installations/new",
            source: "GITHUB_APP_INSTALL_URL"
          }}
        />
      )
    ].join("\n");

    for (const formAction of extractFormActions(html)) {
      expect(isImplementedDashboardRoute(formAction), `form action -> ${formAction}`).toBe(true);
    }

    for (const anchor of extractAnchors(html)) {
      const destination = classifyDashboardDestination(anchor.href);

      if (destination.kind === "internal") {
        expect(destination.routeReady, `${anchor.href} is not implemented`).toBe(true);
        expect(anchor.tag).not.toContain('data-dashboard-destination="external"');
      } else {
        expect(anchor.tag, `${anchor.href} must be explicitly marked external`).toContain('data-dashboard-destination="external"');
        expect(anchor.tag, `${anchor.href} must identify InsForge or GitHub`).toMatch(/data-dashboard-provider="(identity|github)"/);
      }
    }
  });

  it("disables planned InsForge settings actions when InsForge URLs are not external route-ready destinations", () => {
    const generalHtml = renderToString(<SettingsView state={{ status: "populated", data: internalIdentitySettings }} activeTab="general" />);
    const membersHtml = renderToString(<SettingsView state={{ status: "populated", data: internalIdentitySettings }} activeTab="members" />);

    expect(generalHtml).not.toContain('href="/user-profile"');
    expect(generalHtml).not.toContain('href="/organization-profile"');
    expect(generalHtml).toContain("Open profile is planned until its internal destination is route-ready.");
    expect(generalHtml).toContain("Open workspace is planned until its internal destination is route-ready.");
    expect(membersHtml).not.toContain('href="/organization-profile/members"');
    expect(membersHtml).toContain("Open members is planned until its internal destination is route-ready.");
  });

  it("keeps disabled planned controls rendered as disabled buttons with titles", () => {
    const settingsHtml = renderToString(<SettingsView state={{ status: "populated", data: externalSettings }} activeTab="api-keys" />);
    const githubHtml = renderToString(
      <GitHubInstallationsView
        state={{ status: "populated", data: syncData(externalSettings, true) }}
        installConfig={{
          status: "configured",
          installUrl: "https://github.com/apps/firmcode/installations/new",
          source: "GITHUB_APP_INSTALL_URL"
        }}
      />
    );
    const billingHtml = renderToString(<BillingView state={{ status: "populated", data: developerBilling }} billingPortalUrl={null} />);

    expect(settingsHtml).toContain("Workspace API keys are planned and not enabled in the MVP.");
    expect(settingsHtml).toContain("disabled=\"\"");
    expect(githubHtml).toContain("Configure");
    expect(githubHtml).toContain("You do not have permission.");
    expect(githubHtml).toContain("Manual review runs are planned");
    expect(billingHtml).toContain("Admin permission is required to manage subscriptions.");
    expect(billingHtml).toContain("disabled=\"\"");
  });
});

function extractAnchors(html: string): Array<{ href: string; tag: string }> {
  return [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].map((match) => ({
    href: decodeHtmlAttribute(match[1]),
    tag: match[0]
  }));
}

function extractFormActions(html: string): string[] {
  return [...html.matchAll(/<form\b[^>]*action="([^"]+)"[^>]*>/g)].map((match) => decodeHtmlAttribute(match[1]));
}

function decodeHtmlAttribute(value: string): string {
  return value.replaceAll("&amp;", "&");
}

function discoverNextRoutes(): string[] {
  const appDir = fileURLToPath(new URL("../app", import.meta.url));
  const routes: string[] = [];

  walk(appDir);

  return routes.sort();

  function walk(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.name !== "page.tsx" && entry.name !== "route.ts") {
        continue;
      }

      const routeDirectory = relative(appDir, directory);
      const route = routeDirectory === "" ? "/" : `/${routeDirectory}`;
      routes.push(normalizeRoutePattern(route));
    }
  }
}

function normalizeRoutePattern(route: string): string {
  return route.replace(/\/\([^/]+\)/g, "");
}

const repositoryList: RepositoryListResponse = {
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
      openFindingsCount: 2,
      updatedAt: "2026-05-22T10:00:00.000Z",
      lastReview: {
        reviewRunId: "run-1",
        pullRequestNumber: 7,
        pullRequestTitle: "Add route readiness",
        status: "succeeded",
        headSha: "abc123def456",
        createdAt: "2026-05-22T10:00:00.000Z",
        finishedAt: "2026-05-22T10:02:00.000Z"
      }
    }
  ]
};

const reviewRuns: ReviewRunListItem[] = [
  {
    id: "run-1",
    repositoryId: "repo-1",
    pullRequestId: "pr-1",
    repositoryFullName: "openclaw/firmcode",
    pullRequestNumber: 7,
    pullRequestTitle: "Add route readiness",
    pullRequestAuthor: "kelly",
    triggerEvent: "pull_request.opened",
    currentStage: "Comments Published",
    durationMs: 120000,
    commentsPostedCount: 2,
    filesAnalyzedCount: 4,
    riskLevel: "high",
    headSha: "abc123def456",
    status: "failed",
    findingsCount: 4,
    startedAt: "2026-05-22T10:00:00.000Z",
    finishedAt: null,
    createdAt: "2026-05-22T10:00:00.000Z",
    updatedAt: "2026-05-22T10:02:00.000Z"
  }
];

const supplement: OverviewSupplementData = {
  securityFindingsCount: 5,
  ciFailuresExplainedCount: 2,
  highSeverityFindings: [
    {
      id: "finding-1",
      kind: "high_severity_finding",
      title: "High severity finding",
      detail: "openclaw/firmcode has an authentication-path finding awaiting triage.",
      href: "/findings?severity=high",
      severity: "high",
      updatedAt: "2026-05-22T09:30:00.000Z"
    }
  ],
  ciFailures: [
    {
      id: "ci-1",
      kind: "ci_failure",
      title: "CI failure",
      detail: "firmcode dashboard tests need a failure explanation review.",
      href: "/ci-failures",
      severity: "medium",
      updatedAt: "2026-05-22T08:45:00.000Z"
    }
  ],
  incompleteRepositoryConfigurationRepositoryIds: ["repo-1"],
  qualityMetrics: [
    {
      label: "Inline comment rate",
      value: "42%",
      helper: "Findings posted inline",
      tone: "info"
    }
  ]
};

const overviewData = buildOverviewDashboardData({
  repositories: repositoryList.repositories,
  reviewRuns,
  supplement,
  now: new Date("2026-05-24T12:00:00.000Z")
});

const connectedOAuth = {
  connected: true,
  user: {
    githubUserId: 42,
    login: "kelly",
    name: "Kelly",
    avatarUrl: null,
    connectedAt: "2026-05-22T09:00:00.000Z",
    updatedAt: "2026-05-22T09:00:00.000Z"
  }
};

const externalSettings: WorkspaceSettingsResponse = {
  workspace: {
    id: "workspace-1",
    name: "Firmcode",
    identityWorkspaceId: "org_firmcode",
    role: "admin",
    canManageSensitiveSettings: true
  },
  identity: {
    userProfileUrl: "https://accounts.identity.example/user",
    workspaceProfileUrl: "https://accounts.identity.example/organization",
    memberManagementUrl: "https://accounts.identity.example/members"
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
        repositoryCount: 1,
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

const internalIdentitySettings: WorkspaceSettingsResponse = {
  ...externalSettings,
  identity: {
    userProfileUrl: "/user-profile",
    workspaceProfileUrl: "/organization-profile",
    memberManagementUrl: "/organization-profile/members"
  }
};

const billing: WorkspaceBillingResponse = {
  workspace: {
    id: "workspace-1",
    role: "admin",
    canManageBilling: true,
    source: "insforge"
  },
  plan: {
    name: "InsForge managed",
    status: "active"
  },
  usage: {
    reviewRunsThisMonth: null,
    aiTokensThisMonth: null,
    repositoriesMonitored: null,
    seats: null
  }
};

const developerBilling: WorkspaceBillingResponse = {
  ...billing,
  workspace: {
    ...billing.workspace,
    role: "developer",
    canManageBilling: false
  }
};

function syncData(settings: WorkspaceSettingsResponse, oauthConnected: boolean) {
  return {
    settings,
    oauth: oauthConnected ? connectedOAuth : { connected: false, user: null },
    repositories: repositoryList
  };
}
