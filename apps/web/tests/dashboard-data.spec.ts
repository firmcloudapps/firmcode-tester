import type { FindingsListResponse } from "@firmcode/shared";
import {
  loadAdminOverviewState,
  loadBillingState,
  loadCiFailureDetailState,
  loadCiFailuresState,
  loadFindingsState,
  loadGitHubInstallationsState,
  loadGitHubRepositoryControlsState,
  loadRepositoryDetailState,
  loadRulesState,
  loadReviewRunDetailState,
  loadSettingsState
} from "../lib/dashboard-data";

describe("dashboard findings data loader", () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalTestWorkspaceId = process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID;
  const originalTestToken = process.env.FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN;

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    restoreEnv("FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID", originalTestWorkspaceId);
    restoreEnv("FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN", originalTestToken);
    vi.unstubAllGlobals();
  });

  it("maps every findings filter into the API query string", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN = "session-token";
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(findingsResponse));

    vi.stubGlobal("fetch", fetcher);

    await expect(
      loadFindingsState({
        severity: "high",
        source: "semgrep",
        category: "security",
        repository: "openclaw/firmcode",
        repositoryId: "repo-1",
        status: "posted",
        postedInline: "true",
        dateFrom: "2026-05-22",
        dateTo: "2026-05-23"
      })
    ).resolves.toMatchObject({ status: "populated" });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(url.pathname).toBe("/api/findings");
    expect(url.searchParams.get("severity")).toBe("high");
    expect(url.searchParams.get("source")).toBe("semgrep");
    expect(url.searchParams.get("category")).toBe("security");
    expect(url.searchParams.get("repository")).toBe("openclaw/firmcode");
    expect(url.searchParams.get("repositoryId")).toBe("repo-1");
    expect(url.searchParams.get("status")).toBe("posted");
    expect(url.searchParams.get("postedInline")).toBe("true");
    expect(url.searchParams.get("dateFrom")).toBe("2026-05-22");
    expect(url.searchParams.get("dateTo")).toBe("2026-05-23");
    expect(headers.get("authorization")).toBe("Bearer session-token");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
  });

  it("fetches settings data with dashboard bearer auth and the optional workspace selector", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(settingsResponse));

    vi.stubGlobal("fetch", fetcher);

    await expect(loadSettingsState()).resolves.toMatchObject({ status: "populated" });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(url.pathname).toBe("/api/settings");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
  });

  it("treats settings with no GitHub installation as empty", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN = "session-token";
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        ...settingsResponse,
        githubApp: {
          ...settingsResponse.githubApp,
          installations: []
        }
      })
    );

    vi.stubGlobal("fetch", fetcher);

    await expect(loadSettingsState()).resolves.toMatchObject({ status: "empty" });
  });

  it("fetches rules policies with dashboard auth headers and repository selection", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(rulesPolicyResponse));

    vi.stubGlobal("fetch", fetcher);

    await expect(loadRulesState({ repositoryId: "repo-1" })).resolves.toMatchObject({ status: "populated" });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(url.pathname).toBe("/api/rules");
    expect(url.searchParams.get("repositoryId")).toBe("repo-1");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
  });

  it("maps a missing InsForge session to signed-out state before calling the API", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({ message: "Unauthorized" }, 401));

    vi.stubGlobal("fetch", fetcher);

    await expect(loadGitHubInstallationsState()).resolves.toEqual({ status: "signed-out" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("loads GitHub installation entrypoint status from workspace settings", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
    const fetcher = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const pathname = new URL(String(input)).pathname;

      if (pathname === "/api/github/oauth/status") {
        return jsonResponse(oauthResponse);
      }

      if (pathname === "/api/repositories") {
        return jsonResponse(repositoryResponse);
      }

      return jsonResponse(settingsResponse);
    });

    vi.stubGlobal("fetch", fetcher);

    await expect(loadGitHubInstallationsState()).resolves.toMatchObject({
      status: "populated",
      data: {
        oauth: { connected: true },
        repositories: { repositories: [{ fullName: "openclaw/firmcode" }] }
      }
    });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(url.pathname).toBe("/api/settings");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
  });

  it("loads repository GitHub control status without routing controls to missing pages", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
    const fetcher = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const pathname = new URL(String(input)).pathname;
      return jsonResponse(pathname === "/api/github/oauth/status" ? oauthResponse : settingsResponse);
    });

    vi.stubGlobal("fetch", fetcher);

    await expect(loadGitHubRepositoryControlsState()).resolves.toMatchObject({
      status: "ready",
      data: { oauth: { connected: true } }
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("fetches review run detail with dashboard auth headers for artifact role gating", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(reviewRunDetailResponse));

    vi.stubGlobal("fetch", fetcher);

    await expect(loadReviewRunDetailState("run-1")).resolves.toMatchObject({ status: "populated" });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(url.pathname).toBe("/api/review-runs/run-1");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
  });

  it("maps CI failure filters into the authenticated API query string", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ ciFailures: [{ id: "failure-1" }], filters: {}, pagination: { limit: 25, returned: 1 } })
    );

    vi.stubGlobal("fetch", fetcher);

    await expect(
      loadCiFailuresState({
        repository: "openclaw/firmcode",
        repositoryId: "repo-1",
        status: "failed",
        flaky: "false",
        dateFrom: "2026-05-20",
        dateTo: "2026-05-24",
        limit: "25"
      })
    ).resolves.toMatchObject({ status: "populated" });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(url.pathname).toBe("/api/ci-failures");
    expect(url.searchParams.get("repository")).toBe("openclaw/firmcode");
    expect(url.searchParams.get("repositoryId")).toBe("repo-1");
    expect(url.searchParams.get("status")).toBe("failed");
    expect(url.searchParams.get("flaky")).toBe("false");
    expect(url.searchParams.get("dateFrom")).toBe("2026-05-20");
    expect(url.searchParams.get("dateTo")).toBe("2026-05-24");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
  });

  it("fetches CI failure detail with dashboard auth headers and maps 404 to empty", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
    const fetcher = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const pathname = new URL(String(input)).pathname;
      return pathname.endsWith("/missing") ? jsonResponse({ message: "CI failure not found" }, 404) : jsonResponse({ id: "failure-1" });
    });

    vi.stubGlobal("fetch", fetcher);

    await expect(loadCiFailureDetailState("failure-1%3Aunit-tests")).resolves.toMatchObject({ status: "populated" });
    await expect(loadCiFailureDetailState("missing")).resolves.toEqual({ status: "empty" });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(url.pathname).toBe("/api/ci-failures/failure-1%3Aunit-tests");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
  });

  it("fetches repository detail with dashboard auth headers and maps 404 to empty", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
    const fetcher = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const pathname = new URL(String(input)).pathname;
      return pathname.endsWith("/missing") ? jsonResponse({ message: "Repository not found" }, 404) : jsonResponse(repositoryDetailResponse);
    });

    vi.stubGlobal("fetch", fetcher);

    await expect(loadRepositoryDetailState("repo-1")).resolves.toMatchObject({ status: "populated" });
    await expect(loadRepositoryDetailState("missing")).resolves.toEqual({ status: "empty" });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(url.pathname).toBe("/api/repositories/repo-1");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
  });

  it("fetches billing with dashboard bearer auth and no billing capability shim", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(billingResponse));

    vi.stubGlobal("fetch", fetcher);

    await expect(loadBillingState()).resolves.toMatchObject({ status: "populated" });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(url.pathname).toBe("/api/billing");
    expect(headers.get("authorization")).toBe("Bearer session-token");
    expect(headers.get("x-firmcode-billing-capability")).toBeNull();
  });

  it("loads admin overview KPIs from the platform endpoint alongside settings and billing", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
    const fetcher = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const pathname = new URL(String(input)).pathname;

      if (pathname === "/api/platform/overview") {
        return jsonResponse(platformOverviewResponse);
      }

      if (pathname === "/api/billing") {
        return jsonResponse(billingResponse);
      }

      return jsonResponse(settingsResponse);
    });

    vi.stubGlobal("fetch", fetcher);

    await expect(loadAdminOverviewState()).resolves.toMatchObject({
      status: "populated",
      data: {
        overview: {
          metrics: {
            totalRegisteredUsers: 42,
            totalConnectedRepositories: 18,
            totalRevenueStatus: "unavailable"
          }
        },
        settings: {
          workspace: { role: "admin" }
        }
      }
    });

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(new URL(String(fetcher.mock.calls[0]?.[0])).pathname).toBe("/api/platform/overview");
  });
});

const findingsResponse: FindingsListResponse = {
  filters: {},
  findings: [
    {
      id: "finding-1",
      reviewRunId: "run-1",
      repositoryId: "repo-1",
      repositoryFullName: "openclaw/firmcode",
      pullRequestNumber: 7,
      pullRequestTitle: "Add findings inbox",
      source: "semgrep",
      category: "security",
      severity: "high",
      confidence: "high",
      filePath: "src/server.ts",
      startLine: 42,
      endLine: 42,
      title: "Guard repository access",
      body: "Repository access must be workspace scoped.",
      evidence: [],
      suggestion: null,
      dedupeKey: "finding-1",
      postAsInline: true,
      postedInline: true,
      status: "posted",
      semgrepRuleId: "rule.id",
      postedAt: "2026-05-22T10:01:00.000Z",
      githubCommentId: 8002,
      githubCommentUrl: "https://github.com/openclaw/firmcode/pull/7#discussion_r8002",
      reviewRunCreatedAt: "2026-05-22T10:00:00.000Z",
      createdAt: "2026-05-22T10:00:00.000Z"
    }
  ]
};

const settingsResponse = {
  workspace: {
    id: "workspace-1",
    name: "Firmcode",
    identityWorkspaceId: "org_firmcode",
    role: "admin",
    canManageSensitiveSettings: true
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

const oauthResponse = {
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

const repositoryResponse = {
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

const repositoryDetailResponse = {
  repository: repositoryResponse.repositories[0],
  configuration: {
    repositoryId: "repo-1",
    automationEnabled: true,
    draftPullRequestReviewsEnabled: false,
    maxInlineComments: 10,
    severityThreshold: "medium",
    semgrepEnabled: true,
    treeSitterEnabled: true,
    ciExplanationEnabled: true,
    infrastructureReviewEnabled: true,
    dryRunEnabled: true,
    updatedByUserId: null,
    createdAt: "2026-05-22T09:00:00.000Z",
    updatedAt: "2026-05-22T09:00:00.000Z"
  },
  pullRequests: [],
  reviewRuns: [],
  findings: [],
  activity: [],
  permissions: {
    canManageConfiguration: true,
    canRetryReviewRuns: true,
    canAccessRawArtifacts: true
  }
};

const rulesPolicy = {
  workspaceId: "workspace-1",
  repositoryId: null,
  scope: "workspace",
  reviewPreferences: {
    reviewDraftPullRequests: false,
    requireTestsForRiskyChanges: true,
    suggestMissingTests: true
  },
  commentPolicy: {
    maxInlineComments: 8,
    severityThreshold: "medium"
  },
  categories: {
    bug: true,
    security: true,
    performance: true,
    maintainability: true,
    test: true,
    infra: true,
    ci: true
  },
  promptInstructions: "Prefer concise comments.",
  ignoredPaths: ["dist/**"],
  generatedFileIgnorePatterns: ["**/*.generated.ts"],
  semgrep: {
    enabled: true,
    includeInfrastructureRules: true,
    scanGeneratedFilesForSecrets: true
  },
  analysis: {
    treeSitterEnabled: true,
    llmReviewEnabled: true,
    ciExplanationEnabled: true
  },
  infrastructureSecurity: {
    infrastructureReviewEnabled: true,
    securityReviewEnabled: true,
    dependencyReviewEnabled: true,
    ciWorkflowReviewEnabled: true
  },
  updatedByUserId: "user_admin",
  createdAt: "2026-05-22T09:00:00.000Z",
  updatedAt: "2026-05-22T09:00:00.000Z"
};

const rulesPolicyResponse = {
  workspacePolicy: rulesPolicy,
  repositoryPolicies: [
    {
      repositoryId: "repo-1",
      fullName: "openclaw/firmcode",
      policy: {
        ...rulesPolicy,
        repositoryId: "repo-1",
        scope: "repository",
        promptInstructions: "Repository override."
      }
    }
  ],
  selectedRepositoryPolicy: {
    ...rulesPolicy,
    repositoryId: "repo-1",
    scope: "repository",
    promptInstructions: "Repository override."
  },
  permissions: {
    canManagePolicies: true
  }
};

const reviewRunDetailResponse = {
  id: "run-1",
  repositoryId: "repo-1",
  pullRequestId: "pr-1",
  repositoryFullName: "openclaw/firmcode",
  pullRequestNumber: 7,
  pullRequestTitle: "Add details",
  headSha: "abc123",
  status: "succeeded",
  findingsCount: 0,
  startedAt: null,
  finishedAt: null,
  createdAt: "2026-05-22T10:00:00.000Z",
  updatedAt: "2026-05-22T10:00:00.000Z",
  triggerEvent: "pull_request.opened",
  errorCode: null,
  errorMessage: null,
  metrics: {},
  durationMs: null,
  filesAnalyzedCount: 0,
  semgrepFindingsCount: 0,
  aiFindingsCount: 0,
  inlineCommentsPostedCount: 0,
  tokenUsage: null,
  estimatedCostUsd: null,
  riskLevel: "unknown",
  pipelineStages: [],
  changedFiles: [],
  findings: [],
  artifacts: [],
  logExcerpts: [],
  publishedComments: [],
  permissions: {
    canRetryReviewRun: true,
    canAccessRawArtifacts: true
  }
};

const billingResponse = {
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

const platformOverviewResponse = {
  metrics: {
    totalRegisteredUsers: 42,
    totalConnectedRepositories: 18,
    totalRevenueUsdCents: null,
    totalRevenueStatus: "unavailable"
  },
  generatedAt: "2026-05-22T11:00:00.000Z"
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
