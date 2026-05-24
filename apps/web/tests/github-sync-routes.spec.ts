import { GET as startGitHubOAuth } from "../app/auth/github/route";
import { POST as syncInstallations } from "../app/api/github/installations/sync/route";
import { GET as readRules, PATCH as saveRules } from "../app/api/rules/route";
import { POST as syncRepository } from "../app/api/repositories/[id]/sync/route";

describe("GitHub sync routes", () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalDashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL;
  const originalWorkspaceId = process.env.FIRMCODE_DASHBOARD_WORKSPACE_ID;
  const originalClerkUserId = process.env.FIRMCODE_DASHBOARD_CLERK_USER_ID;

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    process.env.NEXT_PUBLIC_DASHBOARD_URL = originalDashboardUrl;
    process.env.FIRMCODE_DASHBOARD_WORKSPACE_ID = originalWorkspaceId;
    process.env.FIRMCODE_DASHBOARD_CLERK_USER_ID = originalClerkUserId;
    vi.unstubAllGlobals();
  });

  it("routes Connect GitHub through the implemented OAuth start endpoint", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_DASHBOARD_WORKSPACE_ID = "workspace-1";
    process.env.FIRMCODE_DASHBOARD_CLERK_USER_ID = "user-1";
    const fetcher = vi.fn(async () =>
      jsonResponse({
        authorizationUrl: "https://github.com/login/oauth/authorize?client_id=firmcode",
        expiresAt: "2026-05-24T12:00:00.000Z"
      })
    );

    vi.stubGlobal("fetch", fetcher);

    const response = await startGitHubOAuth();
    const calls = fetcher.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
    const init = calls[0]?.[1] ?? {};
    const headers = new Headers(init.headers);

    expect(new URL(String(calls[0]?.[0])).pathname).toBe("/auth/github");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBe("user-1");
    expect(response.headers.get("location")).toBe("https://github.com/login/oauth/authorize?client_id=firmcode");
  });

  it("routes Sync GitHub to the installation sync API with dashboard auth headers", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_DASHBOARD_WORKSPACE_ID = "workspace-1";
    process.env.FIRMCODE_DASHBOARD_CLERK_USER_ID = "user-1";
    const fetcher = vi.fn(async () => jsonResponse({ installations: [], syncedRepositoryCount: 0 }));

    vi.stubGlobal("fetch", fetcher);

    const response = await syncInstallations(new Request("http://localhost/api/github/installations/sync", {
      method: "POST",
      body: JSON.stringify({ installationId: 301 })
    }));
    const calls = fetcher.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
    const init = calls[0]?.[1] ?? {};
    const headers = new Headers(init.headers);

    expect(response.status).toBe(200);
    expect(new URL(String(calls[0]?.[0])).pathname).toBe("/api/github/installations/sync");
    expect(init.body).toBe(JSON.stringify({ installationId: 301 }));
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBe("user-1");
  });

  it("routes repository row Sync to the repository sync API", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    const fetcher = vi.fn(async () => jsonResponse({ repository: { id: "repo-1" } }));

    vi.stubGlobal("fetch", fetcher);

    const response = await syncRepository(new Request("http://localhost/api/repositories/repo-1/sync", {
      method: "POST"
    }), {
      params: { id: "repo-1" }
    });

    expect(response.status).toBe(200);
    const calls = fetcher.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
    expect(new URL(String(calls[0]?.[0])).pathname).toBe("/api/repositories/repo-1/sync");
  });

  it("routes Rules / Policies reads to the role-aware API endpoint", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_DASHBOARD_WORKSPACE_ID = "workspace-1";
    process.env.FIRMCODE_DASHBOARD_CLERK_USER_ID = "user-1";
    const fetcher = vi.fn(async () => jsonResponse({ workspacePolicy: {}, repositoryPolicies: [], selectedRepositoryPolicy: null }));

    vi.stubGlobal("fetch", fetcher);

    const response = await readRules(new Request("http://localhost/api/rules?repositoryId=repo-1"));
    const calls = fetcher.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
    const init = calls[0]?.[1] ?? {};
    const headers = new Headers(init.headers);
    const url = new URL(String(calls[0]?.[0]));

    expect(response.status).toBe(200);
    expect(url.pathname).toBe("/api/rules");
    expect(url.searchParams.get("repositoryId")).toBe("repo-1");
    expect(init.method).toBe("GET");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBe("user-1");
  });

  it("routes Rules / Policies saves to the role-gated API endpoint", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_DASHBOARD_WORKSPACE_ID = "workspace-1";
    process.env.FIRMCODE_DASHBOARD_CLERK_USER_ID = "user-1";
    const fetcher = vi.fn(async () => jsonResponse({ workspacePolicy: {}, repositoryPolicies: [], selectedRepositoryPolicy: null }));

    vi.stubGlobal("fetch", fetcher);

    const response = await saveRules(
      new Request("http://localhost/api/rules", {
        method: "PATCH",
        body: JSON.stringify({ commentPolicy: { maxInlineComments: 4 } })
      })
    );
    const calls = fetcher.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
    const init = calls[0]?.[1] ?? {};
    const headers = new Headers(init.headers);

    expect(response.status).toBe(200);
    expect(new URL(String(calls[0]?.[0])).pathname).toBe("/api/rules");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ commentPolicy: { maxInlineComments: 4 } }));
    expect(headers.get("content-type")).toBe("application/json");
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
