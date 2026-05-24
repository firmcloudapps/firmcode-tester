import type { PullRequestDetailResponse, PullRequestListResponse } from "@firmcode/shared";
import { loadPullRequestDetailState, loadPullRequestsState } from "../lib/dashboard-data";

describe("dashboard pull request data loader", () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalWorkspaceId = process.env.FIRMCODE_DASHBOARD_WORKSPACE_ID;
  const originalClerkUserId = process.env.FIRMCODE_DASHBOARD_CLERK_USER_ID;

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    process.env.FIRMCODE_DASHBOARD_WORKSPACE_ID = originalWorkspaceId;
    process.env.FIRMCODE_DASHBOARD_CLERK_USER_ID = originalClerkUserId;
    vi.unstubAllGlobals();
  });

  it("maps pull request filters into the authenticated API query string", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_DASHBOARD_WORKSPACE_ID = "workspace-1";
    process.env.FIRMCODE_DASHBOARD_CLERK_USER_ID = "user-1";
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(pullRequests));

    vi.stubGlobal("fetch", fetcher);

    await expect(
      loadPullRequestsState({
        repository: "openclaw/firmcode",
        repositoryId: "repo-1",
        status: "open",
        riskLevel: "high",
        reviewStatus: "failed",
        author: "kelly",
        dateFrom: "2026-05-20",
        dateTo: "2026-05-24",
        limit: "25"
      })
    ).resolves.toMatchObject({ status: "populated" });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(url.pathname).toBe("/api/pull-requests");
    expect(url.searchParams.get("repository")).toBe("openclaw/firmcode");
    expect(url.searchParams.get("repositoryId")).toBe("repo-1");
    expect(url.searchParams.get("status")).toBe("open");
    expect(url.searchParams.get("riskLevel")).toBe("high");
    expect(url.searchParams.get("reviewStatus")).toBe("failed");
    expect(url.searchParams.get("author")).toBe("kelly");
    expect(url.searchParams.get("dateFrom")).toBe("2026-05-20");
    expect(url.searchParams.get("dateTo")).toBe("2026-05-24");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBe("user-1");
  });

  it("loads pull request detail with auth headers and maps 404 to empty", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_DASHBOARD_WORKSPACE_ID = "workspace-1";
    process.env.FIRMCODE_DASHBOARD_CLERK_USER_ID = "user-1";
    const fetcher = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const pathname = new URL(String(input)).pathname;
      return pathname.endsWith("/missing") ? jsonResponse({ message: "Pull request not found" }, 404) : jsonResponse(pullRequestDetail);
    });

    vi.stubGlobal("fetch", fetcher);

    await expect(loadPullRequestDetailState("pr-1")).resolves.toMatchObject({ status: "populated" });
    await expect(loadPullRequestDetailState("missing")).resolves.toEqual({ status: "empty" });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(url.pathname).toBe("/api/pull-requests/pr-1");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBe("user-1");
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

const pullRequests: PullRequestListResponse = {
  filters: {},
  pagination: {
    limit: 50,
    returned: 1
  },
  pullRequests: [
    {
      id: "pr-1",
      repositoryId: "repo-1",
      repositoryFullName: "openclaw/firmcode",
      repositoryPrivate: false,
      number: 7,
      title: "Add pull request dashboard",
      authorLogin: "kelly",
      status: "open",
      state: "open",
      draft: false,
      baseRef: "main",
      headRef: "feature/pr-dashboard",
      headSha: "abc123def4567890",
      latestReview: null,
      riskLevel: "unknown",
      reviewStatus: null,
      githubUrl: "https://github.com/openclaw/firmcode/pull/7",
      createdAt: "2026-05-22T09:00:00.000Z",
      updatedAt: "2026-05-22T10:03:00.000Z"
    }
  ]
};

const pullRequestDetail: PullRequestDetailResponse = {
  ...pullRequests.pullRequests[0],
  summary: "Summary",
  changedComponents: [],
  riskAnalysis: {
    riskLevel: "unknown",
    riskFlags: [],
    summary: null
  },
  reviewTimeline: [],
  findings: [],
  metadata: {
    repositoryId: "repo-1",
    repositoryFullName: "openclaw/firmcode",
    repositoryPrivate: false,
    reviewRunsCount: 0,
    findingsCount: 0,
    changedFilesCount: 0,
    latestReviewStatus: null
  },
  branches: {
    baseRef: "main",
    headRef: "feature/pr-dashboard",
    baseSha: "base1234567890",
    headSha: "abc123def4567890"
  },
  commitSha: "abc123def4567890",
  changedFiles: [],
  durationMs: null
};
