import React from "react";
import { renderToString } from "react-dom/server";
import type { ReviewRunListResponse, WorkspaceSettingsResponse } from "@firmcode/shared";
import { DeveloperPrReviewDashboard } from "../components/dashboard/developer-pr-review-dashboard";

describe("DeveloperPrReviewDashboard", () => {
  it("renders review run history instead of repository inventory", () => {
    const html = renderToString(
      <DeveloperPrReviewDashboard
        installConfig={installConfig}
        state={{
          status: "populated",
          data: {
            settings,
            oauth: connectedOAuth,
            reviewRuns
          }
        }}
      />
    );

    expect(html).toContain("Review Run History");
    expect(html).toContain('href="/review-runs/00000000-0000-4000-8000-000000000006"');
    expect(html).toContain("Comments Published");
    expect(html).toContain("View report");
    expect(html).toContain("Successful runs");
    expect(html).not.toContain("Repositories available for automated PR review.");
    expect(html).not.toContain("No repositories yet");
  });

  it("renders setup guidance and empty review history when no runs exist", () => {
    const html = renderToString(
      <DeveloperPrReviewDashboard
        installConfig={installConfig}
        state={{
          status: "empty",
          data: {
            settings: {
              ...settings,
              githubApp: {
                ...settings.githubApp,
                installations: []
              }
            },
            oauth: { connected: false, user: null },
            reviewRuns: {
              filters: {},
              reviewRuns: []
            }
          }
        }}
      />
    );

    expect(html).toContain("PR review setup is incomplete");
    expect(html).toContain("No PR reviews yet");
    expect(html).toContain("Connect GitHub");
    expect(html).toContain("Open Repositories");
    expect(html).not.toContain("Repositories available for automated PR review.");
  });
});

const installConfig = {
  status: "configured" as const,
  installUrl: "https://github.com/apps/firmcode/installations/new",
  source: "GITHUB_APP_INSTALL_URL" as const
};

const settings: WorkspaceSettingsResponse = {
  workspace: {
    id: "workspace-1",
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
        enabledRepositoryCount: 2,
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

const reviewRuns: ReviewRunListResponse = {
  filters: {},
  reviewRuns: [
    {
      id: "00000000-0000-4000-8000-000000000006",
      repositoryId: "repo-1",
      pullRequestId: "pr-1",
      repositoryFullName: "openclaw/firmcode",
      pullRequestNumber: 7,
      pullRequestTitle: "Add repository dashboard",
      pullRequestAuthor: "kelly",
      triggerEvent: "pull_request.opened",
      headSha: "abc123def456",
      status: "succeeded",
      findingsCount: 2,
      commentsPostedCount: 1,
      filesAnalyzedCount: 2,
      currentStage: "Comments Published",
      durationMs: 120000,
      riskLevel: "high",
      startedAt: "2026-05-22T10:00:00.000Z",
      finishedAt: "2026-05-22T10:02:00.000Z",
      createdAt: "2026-05-22T10:00:00.000Z",
      updatedAt: "2026-05-22T10:02:00.000Z"
    }
  ]
};
