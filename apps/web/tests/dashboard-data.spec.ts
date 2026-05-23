import type { FindingsListResponse, WorkspaceBillingResponse } from "@firmcode/shared";
import { loadBillingState, loadFindingsState, loadSettingsState } from "../lib/dashboard-data";

describe("dashboard findings data loader", () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalWorkspaceId = process.env.FIRMCODE_DASHBOARD_WORKSPACE_ID;
  const originalClerkUserId = process.env.FIRMCODE_DASHBOARD_CLERK_USER_ID;
  const originalClerkBillingRole = process.env.FIRMCODE_DASHBOARD_CLERK_BILLING_ROLE;

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    process.env.FIRMCODE_DASHBOARD_WORKSPACE_ID = originalWorkspaceId;
    process.env.FIRMCODE_DASHBOARD_CLERK_USER_ID = originalClerkUserId;
    process.env.FIRMCODE_DASHBOARD_CLERK_BILLING_ROLE = originalClerkBillingRole;
    vi.unstubAllGlobals();
  });

  it("maps every findings filter into the API query string", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
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
  });

  it("fetches settings data with the temporary Clerk workspace headers", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_DASHBOARD_WORKSPACE_ID = "workspace-1";
    process.env.FIRMCODE_DASHBOARD_CLERK_USER_ID = "user-1";
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(settingsResponse));

    vi.stubGlobal("fetch", fetcher);

    await expect(loadSettingsState()).resolves.toMatchObject({ status: "populated" });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(url.pathname).toBe("/api/settings");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBe("user-1");
  });

  it("fetches billing data with Clerk-gated workspace and billing role headers", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_DASHBOARD_WORKSPACE_ID = "workspace-1";
    process.env.FIRMCODE_DASHBOARD_CLERK_USER_ID = "user-1";
    process.env.FIRMCODE_DASHBOARD_CLERK_BILLING_ROLE = "billing";
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(billingResponse));

    vi.stubGlobal("fetch", fetcher);

    await expect(loadBillingState()).resolves.toMatchObject({ status: "populated" });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(url.pathname).toBe("/api/billing");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBe("user-1");
    expect(headers.get("x-firmcode-clerk-billing-role")).toBe("billing");
  });

  it("maps billing authorization failures to a clear denied state message", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ message: "Forbidden" }, 403)
    );

    vi.stubGlobal("fetch", fetcher);

    await expect(loadBillingState()).resolves.toEqual({
      status: "error",
      message: "Billing access requires workspace Owner/Admin or Clerk billing role."
    });
  });

  it("treats settings with no GitHub installation as empty", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
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

const billingResponse: WorkspaceBillingResponse = {
  workspace: {
    id: "workspace-1",
    name: "Firmcode",
    role: "owner",
    canManageBilling: true,
    billingAccessSource: "workspace_role"
  },
  plan: {
    name: "Clerk managed",
    source: "clerk",
    description: "Plan, checkout, seats, invoices, and subscription mutations stay in Clerk Billing."
  },
  billingStatus: {
    label: "Managed in Clerk",
    source: "clerk"
  },
  usage: {
    monthlyReviewRuns: 3,
    aiTokens: 1200,
    repositories: 2,
    seats: 4,
    periodStart: "2026-05-01T00:00:00.000Z",
    periodEnd: "2026-06-01T00:00:00.000Z"
  }
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}
