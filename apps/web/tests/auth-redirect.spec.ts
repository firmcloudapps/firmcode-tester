import { landingPathForDashboardRole, resolveRoleBasedDashboardRedirect } from "../lib/auth-redirect";

describe("role-based auth redirect", () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalTestWorkspaceId = process.env.FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID;
  const originalTestToken = process.env.FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN;

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    restoreEnv("FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID", originalTestWorkspaceId);
    restoreEnv("FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN", originalTestToken);
  });

  it("maps admin and developer roles to their dashboard landings", () => {
    expect(landingPathForDashboardRole("admin")).toBe("/dashboard/admin");
    expect(landingPathForDashboardRole("owner")).toBe("/dashboard/admin");
    expect(landingPathForDashboardRole("developer")).toBe("/dashboard/developer");
    expect(landingPathForDashboardRole("member")).toBe("/dashboard/developer");
  });

  it("redirects signed-in admins to the admin dashboard", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN = "session-token";
    const fetcher = vi.fn(async () =>
      jsonResponse({
        workspace: { role: "admin" }
      })
    );

    const url = await resolveRoleBasedDashboardRedirect({
      requestUrl: "http://app.test/auth/redirect",
      fetcher
    });

    expect(url.pathname).toBe("/dashboard/admin");
  });

  it("redirects signed-out users back to sign-in before fetching settings", async () => {
    delete process.env.FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN;
    const fetcher = vi.fn(async () => jsonResponse({}, 200));

    const url = await resolveRoleBasedDashboardRedirect({
      requestUrl: "http://app.test/auth/redirect",
      fetcher
    });

    expect(url.pathname).toBe("/sign-in");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("falls back to the neutral dashboard redirect when role lookup fails", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    process.env.FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN = "session-token";

    const responseFailure = await resolveRoleBasedDashboardRedirect({
      requestUrl: "http://app.test/auth/redirect",
      fetcher: vi.fn(async () => jsonResponse({ message: "failed" }, 503))
    });
    const networkFailure = await resolveRoleBasedDashboardRedirect({
      requestUrl: "http://app.test/auth/redirect",
      fetcher: vi.fn(async () => {
        throw new Error("network");
      })
    });

    expect(responseFailure.pathname).toBe("/dashboard");
    expect(networkFailure.pathname).toBe("/dashboard");
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
