import React from "react";
import { renderToString } from "react-dom/server";
import { AdminOverviewView } from "../components/dashboard/admin-overview-view";

describe("AdminOverviewView", () => {
  it("renders platform KPI cards and preserves the existing admin sections", () => {
    const html = renderToString(
      <AdminOverviewView
        state={{
          status: "populated",
          data: {
            overview: {
              metrics: {
                totalRegisteredUsers: 42,
                totalConnectedRepositories: 18,
                totalRevenueUsdCents: null,
                totalRevenueStatus: "unavailable"
              },
              generatedAt: "2026-05-22T11:00:00.000Z"
            },
            settings,
            billing
          }
        }}
      />
    );

    expect(html).toContain("Platform metrics");
    expect(html).toContain("Registered users");
    expect(html).toContain(">42<");
    expect(html).toContain("Connected repositories");
    expect(html).toContain(">18<");
    expect(html).toContain("Total revenue");
    expect(html).toContain("Unavailable");
    expect(html).toContain("GitHub App Installations");
    expect(html).toContain("Workspace");
    expect(html).toContain("Billing");
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

const billing = {
  workspace: {
    id: "workspace-1",
    role: "admin" as const,
    canManageBilling: true,
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
