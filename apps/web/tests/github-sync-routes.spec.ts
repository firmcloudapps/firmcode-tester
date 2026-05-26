import { GET as startGitHubOAuth } from "../app/auth/github/route";
import { GET as completeGitHubOAuth } from "../app/api/auth/github/callback/route";
import { GET as listCiFailures } from "../app/api/ci-failures/route";
import { GET as readCiFailure } from "../app/api/ci-failures/[id]/route";
import { POST as syncInstallations } from "../app/api/github/installations/sync/route";
import { GET as readRules, PATCH as saveRules } from "../app/api/rules/route";
import { PATCH as updateMemberRole } from "../app/api/settings/members/[clerkUserId]/role/route";
import { PATCH as updateMemberStatus } from "../app/api/settings/members/[clerkUserId]/status/route";
import { POST as syncRepository } from "../app/api/repositories/[id]/sync/route";
import { parseGitHubInstallationsNotice } from "../lib/github-installations-notice";

describe("GitHub sync routes", () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalAppUrl = process.env.APP_URL;
  const originalDashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL;
  const originalTestWorkspaceId = process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID;
  const originalTestToken = process.env.FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN;

  afterEach(() => {
    restoreEnv("NEXT_PUBLIC_API_URL", originalApiUrl);
    restoreEnv("APP_URL", originalAppUrl);
    restoreEnv("NEXT_PUBLIC_DASHBOARD_URL", originalDashboardUrl);
    restoreEnv("FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID", originalTestWorkspaceId);
    restoreEnv("FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN", originalTestToken);
    vi.unstubAllGlobals();
  });

  it("routes Connect GitHub through the implemented OAuth start endpoint", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
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
    expect(headers.get("authorization")).toBe("Bearer session-token");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
    expect(response.headers.get("location")).toBe("https://github.com/login/oauth/authorize?client_id=firmcode");
  });

  it("redirects GitHub OAuth start to sign-in before calling the API when Clerk auth is missing", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    const fetcher = vi.fn(async () =>
      jsonResponse({
        authorizationUrl: "https://github.com/login/oauth/authorize?client_id=firmcode"
      })
    );

    vi.stubGlobal("fetch", fetcher);

    const response = await startGitHubOAuth();

    expect(fetcher).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost:3000/sign-in");
  });

  it("routes GitHub OAuth callback through the API and returns to GitHub setup", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.APP_URL = "https://firmcode.firmoncloud.com";
    process.env.FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
    const fetcher = vi.fn(async () => jsonResponse({ connected: true, user: { login: "octo-user" } }));

    vi.stubGlobal("fetch", fetcher);

    const response = await completeGitHubOAuth(
      new Request("https://firmcode.firmoncloud.com/api/auth/github/callback?code=oauth-code&state=oauth-state")
    );
    const calls = fetcher.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
    const callbackUrl = new URL(String(calls[0]?.[0]));
    const headers = new Headers(calls[0]?.[1]?.headers);

    expect(callbackUrl.pathname).toBe("/auth/github/callback");
    expect(callbackUrl.searchParams.get("code")).toBe("oauth-code");
    expect(callbackUrl.searchParams.get("state")).toBe("oauth-state");
    expect(headers.get("authorization")).toBe("Bearer session-token");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
    expect(response.headers.get("location")).toBe("https://firmcode.firmoncloud.com/github/installations?github_oauth=connected");
  });

  it("parses safe GitHub setup callback notices from query params", () => {
    expect(parseGitHubInstallationsNotice({ github_oauth: "connected" })).toBe("oauth-connected");
    expect(parseGitHubInstallationsNotice({ github_oauth: "error" })).toBe("oauth-error");
    expect(parseGitHubInstallationsNotice({ github_installation: "connected" })).toBe("installation-connected");
    expect(parseGitHubInstallationsNotice({ github_installation: "error" })).toBe("installation-error");
    expect(parseGitHubInstallationsNotice({ github_oauth: "oauth-code", github_installation: "raw-payload" })).toBeNull();
  });

  it("redirects GitHub OAuth callback to sign-in before calling the API when Clerk auth is missing", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.APP_URL = "https://firmcode.firmoncloud.com";
    const fetcher = vi.fn(async () => jsonResponse({ connected: true }));

    vi.stubGlobal("fetch", fetcher);

    const response = await completeGitHubOAuth(
      new Request("https://firmcode.firmoncloud.com/api/auth/github/callback?code=oauth-code&state=oauth-state")
    );

    expect(fetcher).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://firmcode.firmoncloud.com/sign-in");
  });

  it("routes Sync GitHub to the installation sync API with dashboard auth headers", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
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
    expect(headers.get("authorization")).toBe("Bearer session-token");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
  });

  it("routes repository row Sync to the repository sync API", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN = "session-token";
    const fetcher = vi.fn(async () => jsonResponse({ repository: { id: "repo-1" } }));

    vi.stubGlobal("fetch", fetcher);

    const response = await syncRepository(new Request("http://localhost/api/repositories/repo-1/sync", {
      method: "POST"
    }), {
      params: { id: "repo-1" }
    });

    expect(response.status).toBe(200);
    const calls = fetcher.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
    const headers = new Headers(calls[0]?.[1]?.headers);
    expect(new URL(String(calls[0]?.[0])).pathname).toBe("/api/repositories/repo-1/sync");
    expect(headers.get("authorization")).toBe("Bearer session-token");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
  });

  it("routes Rules / Policies reads to the role-aware API endpoint", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
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
    expect(headers.get("authorization")).toBe("Bearer session-token");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
  });

  it("routes Rules / Policies saves to the role-gated API endpoint", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
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
    expect(headers.get("authorization")).toBe("Bearer session-token");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
  });

  it("routes workspace member role and status updates to the Settings API", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
    const fetcher = vi.fn(async () => jsonResponse({ clerkUserId: "user_developer", role: "admin", active: true }));

    vi.stubGlobal("fetch", fetcher);

    await updateMemberRole(
      new Request("http://localhost/api/settings/members/user_developer/role", {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" })
      }),
      { params: { clerkUserId: "user_developer" } }
    );
    await updateMemberStatus(
      new Request("http://localhost/api/settings/members/user_developer/status", {
        method: "PATCH",
        body: JSON.stringify({ active: false })
      }),
      { params: { clerkUserId: "user_developer" } }
    );

    const calls = fetcher.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
    const roleUrl = new URL(String(calls[0]?.[0]));
    const statusUrl = new URL(String(calls[1]?.[0]));
    const headers = new Headers(calls[0]?.[1]?.headers);

    expect(roleUrl.pathname).toBe("/api/settings/members/user_developer/role");
    expect(statusUrl.pathname).toBe("/api/settings/members/user_developer/status");
    expect(calls[0]?.[1]?.body).toBe(JSON.stringify({ role: "admin" }));
    expect(calls[1]?.[1]?.body).toBe(JSON.stringify({ active: false }));
    expect(headers.get("authorization")).toBe("Bearer session-token");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
  });

  it("routes CI failure list and detail reads to the authenticated dashboard API", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN = "session-token";
    process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID = "workspace-1";
    const fetcher = vi.fn(async () => jsonResponse({ ciFailures: [], filters: {}, pagination: { limit: 50, returned: 0 } }));

    vi.stubGlobal("fetch", fetcher);

    await listCiFailures(new Request("http://localhost/api/ci-failures?repository=openclaw%2Ffirmcode"));
    await readCiFailure(new Request("http://localhost/api/ci-failures/00000000-0000-4000-8000-000000000501%3Aunit-tests"), {
      params: { id: "00000000-0000-4000-8000-000000000501%3Aunit-tests" }
    });

    const calls = fetcher.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
    const listUrl = new URL(String(calls[0]?.[0]));
    const detailUrl = new URL(String(calls[1]?.[0]));
    const listHeaders = new Headers(calls[0]?.[1]?.headers);

    expect(listUrl.pathname).toBe("/api/ci-failures");
    expect(listUrl.searchParams.get("repository")).toBe("openclaw/firmcode");
    expect(detailUrl.pathname).toBe("/api/ci-failures/00000000-0000-4000-8000-000000000501%3Aunit-tests");
    expect(listHeaders.get("authorization")).toBe("Bearer session-token");
    expect(listHeaders.get("x-firmcode-workspace-id")).toBe("workspace-1");
    expect(listHeaders.get("x-firmcode-user-id")).toBeNull();
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

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
