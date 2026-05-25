import React from "react";
import { renderToString } from "react-dom/server";
import AdminDashboardPage from "../app/admin/page";
import DeveloperDashboardPage from "../app/developer/page";
import SignInPage from "../app/sign-in/[[...sign-in]]/page";
import SignUpPage from "../app/sign-up/[[...sign-up]]/page";
import { clerkAppearance } from "../components/auth/auth-page";
import { DashboardShell } from "../components/dashboard/dashboard-shell";
import {
  ROLE_BASED_AUTH_REDIRECT_PATH,
  landingPathForDashboardRole,
  resolveRoleBasedDashboardRedirect
} from "../lib/auth-redirect";
import { forwardDashboardApiMutation } from "../lib/dashboard-api-proxy";
import { isProtectedDashboardPath, PROTECTED_DASHBOARD_ROUTES } from "../lib/protected-routes";
import middlewareConfig, { hasClerkMiddlewareConfig, protectDashboardRequest } from "../middleware";
import { config as nextMiddlewareConfig } from "../middleware";

describe("Clerk route protection", () => {
  it("marks dashboard pages and route handlers as protected", () => {
    expect(PROTECTED_DASHBOARD_ROUTES).toContain("/api/(.*)");
    expect(isProtectedDashboardPath("/")).toBe(true);
    expect(isProtectedDashboardPath("/repositories")).toBe(true);
    expect(isProtectedDashboardPath("/repositories/repo-1")).toBe(true);
    expect(isProtectedDashboardPath("/api/rules")).toBe(true);
    expect(isProtectedDashboardPath("/auth/github")).toBe(true);
    expect(isProtectedDashboardPath("/auth/redirect")).toBe(true);
    expect(isProtectedDashboardPath("/admin")).toBe(true);
    expect(isProtectedDashboardPath("/developer")).toBe(true);
  });

  it("keeps sign-in and sign-up public for unauthenticated users", () => {
    expect(isProtectedDashboardPath("/sign-in")).toBe(false);
    expect(isProtectedDashboardPath("/sign-up")).toBe(false);
    expect(nextMiddlewareConfig.matcher).toContain("/(api|trpc)(.*)");
    expect(middlewareConfig).toBeTypeOf("function");
  });

  it("redirects unauthenticated dashboard requests to sign-in through Clerk protect", async () => {
    const auth = {
      protect: vi.fn(async () => undefined)
    };

    await protectDashboardRequest(auth, new Request("https://firmcode.test/repositories"));

    expect(auth.protect).toHaveBeenCalledWith();
  });

  it("does not invoke Clerk protect for public auth pages or static assets", async () => {
    const auth = {
      protect: vi.fn(async () => undefined)
    };

    await protectDashboardRequest(auth, new Request("https://firmcode.test/sign-in"));
    await protectDashboardRequest(auth, new Request("https://firmcode.test/assets/logo.svg"));

    expect(auth.protect).not.toHaveBeenCalled();
  });

  it("fails closed for protected routes when Clerk middleware keys are unavailable", async () => {
    const originalPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const originalSecretKey = process.env.CLERK_SECRET_KEY;

    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;

    try {
      expect(hasClerkMiddlewareConfig()).toBe(false);

      const pageResponse = await middlewareConfig(new Request("https://firmcode.test/") as never, {} as never);
      const apiResponse = await middlewareConfig(new Request("https://firmcode.test/api/rules") as never, {} as never);

      expect(pageResponse?.headers.get("location")).toBe("https://firmcode.test/sign-in");
      expect(apiResponse?.status).toBe(401);
      await expect(apiResponse?.json()).resolves.toMatchObject({ message: expect.stringContaining("Clerk session") });
    } finally {
      restoreEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", originalPublishableKey);
      restoreEnv("CLERK_SECRET_KEY", originalSecretKey);
    }
  });
});

describe("Clerk auth pages", () => {
  it("renders the sign-in route with the dedicated auth-page shell and role redirect target", async () => {
    const html = renderToString(await SignInPage());

    expect(html).toContain('data-auth-page="sign-in"');
    expect(html).toContain("PR review workspace");
    expect(html).toContain('data-auth-panel="true"');
    expect(html).toContain('data-clerk-component="SignIn"');
    expect(html).toContain(`data-clerk-force-redirect-url="${ROLE_BASED_AUTH_REDIRECT_PATH}"`);
    expect(html).not.toContain('data-clerk-authenticated="required"');
  });

  it("renders the sign-up route with the same constrained responsive layout and role redirect target", async () => {
    const html = renderToString(await SignUpPage());

    expect(html).toContain('data-auth-page="sign-up"');
    expect(html).toContain("Create your Firmcode workspace");
    expect(html).toContain("max-w-[460px]");
    expect(html).toContain("md:grid-cols-[minmax(0,0.9fr)_minmax(400px,460px)]");
    expect(html).toContain('data-clerk-component="SignUp"');
    expect(html).toContain(`data-clerk-force-redirect-url="${ROLE_BASED_AUTH_REDIRECT_PATH}"`);
  });

  it("keeps Clerk appearance hooks compact and dashboard-token aligned", () => {
    expect(clerkAppearance.elements.cardBox).toContain("border-border");
    expect(clerkAppearance.elements.cardBox).toContain("rounded-lg");
    expect(clerkAppearance.elements.formButtonPrimary).toContain("bg-accent");
    expect(clerkAppearance.elements.formButtonPrimary).toContain("focus:ring-accent");
  });
});

describe("role-based auth redirect", () => {
  it("maps Admin and owner-equivalent roles to the Admin dashboard", () => {
    expect(landingPathForDashboardRole("admin")).toBe("/admin");
    expect(landingPathForDashboardRole("owner")).toBe("/admin");
  });

  it("maps Developer, member-equivalent, and unsupported roles to the Developer dashboard", () => {
    expect(landingPathForDashboardRole("developer")).toBe("/developer");
    expect(landingPathForDashboardRole("member")).toBe("/developer");
    expect(landingPathForDashboardRole("viewer")).toBe("/developer");
    expect(landingPathForDashboardRole(undefined)).toBe("/developer");
  });

  it("redirects authenticated Admin users to /admin", async () => {
    const fetcher = vi.fn(async (_input: Parameters<typeof fetch>[0]) => jsonResponse({ workspace: { role: "admin" } }));

    const redirectUrl = await resolveRoleBasedDashboardRedirect({
      requestUrl: "https://firmcode.test/auth/redirect",
      env: dashboardAuthEnv(),
      fetcher
    });

    expect(redirectUrl.toString()).toBe("https://firmcode.test/admin");
    expect(new URL(String(fetcher.mock.calls[0]![0])).pathname).toBe("/api/settings");
  });

  it("redirects authenticated Developer users to /developer", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ workspace: { role: "developer" } }));

    const redirectUrl = await resolveRoleBasedDashboardRedirect({
      requestUrl: "https://firmcode.test/auth/redirect",
      env: dashboardAuthEnv(),
      fetcher
    });

    expect(redirectUrl.toString()).toBe("https://firmcode.test/developer");
  });

  it("redirects missing or invalid sessions to sign-in", async () => {
    const missingSessionFetcher = vi.fn(async () => jsonResponse({ workspace: { role: "admin" } }));
    const missingSessionRedirect = await resolveRoleBasedDashboardRedirect({
      requestUrl: "https://firmcode.test/auth/redirect",
      env: { NEXT_PUBLIC_API_URL: "http://dashboard-api.test" },
      fetcher: missingSessionFetcher
    });
    const invalidSessionRedirect = await resolveRoleBasedDashboardRedirect({
      requestUrl: "https://firmcode.test/auth/redirect",
      env: dashboardAuthEnv(),
      fetcher: vi.fn(async () => new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 }))
    });

    expect(missingSessionRedirect.toString()).toBe("https://firmcode.test/sign-in");
    expect(missingSessionFetcher).not.toHaveBeenCalled();
    expect(invalidSessionRedirect.toString()).toBe("https://firmcode.test/sign-in");
  });

  it("falls back to the Developer dashboard when role lookup fails after authentication", async () => {
    const redirectUrl = await resolveRoleBasedDashboardRedirect({
      requestUrl: "https://firmcode.test/auth/redirect",
      env: dashboardAuthEnv(),
      fetcher: vi.fn(async () => new Response(JSON.stringify({ message: "API unavailable" }), { status: 503 }))
    });

    expect(redirectUrl.toString()).toBe("https://firmcode.test/developer");
  });
});

describe("role landing dashboard pages", () => {
  it("renders the Admin dashboard route with the existing settings controls", async () => {
    const restore = withDashboardEnv();
    const fetcher = vi.fn(async (_input: Parameters<typeof fetch>[0]) => jsonResponse(settingsResponse("admin")));
    vi.stubGlobal("fetch", fetcher);

    try {
      const html = renderToString(await AdminDashboardPage());

      expect(html).toContain('data-clerk-authenticated="required"');
      expect(html).toContain("Workspace role");
      expect(html).toContain("Admin");
      expect(new URL(String(fetcher.mock.calls[0]![0])).pathname).toBe("/api/settings");
    } finally {
      restore();
      vi.unstubAllGlobals();
    }
  });

  it("renders the Developer dashboard route with the existing PR Review setup workflow", async () => {
    const restore = withDashboardEnv();
    const fetcher = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const pathname = new URL(String(input)).pathname;

      if (pathname === "/api/settings") {
        return jsonResponse(settingsResponse("developer"));
      }

      if (pathname === "/api/github/oauth/status") {
        return jsonResponse({ connected: false, user: null });
      }

      return jsonResponse({ repositories: [], filters: {} });
    });
    vi.stubGlobal("fetch", fetcher);

    try {
      const html = renderToString(await DeveloperDashboardPage());

      expect(html).toContain('data-clerk-authenticated="required"');
      expect(html).toContain("GitHub OAuth");
      expect(html).toContain("GitHub App");
      expect(fetcher).toHaveBeenCalledTimes(3);
    } finally {
      restore();
      vi.unstubAllGlobals();
    }
  });
});

describe("Clerk dashboard shell controls", () => {
  it("renders Clerk account controls and active workspace display", () => {
    const html = renderToString(
      <DashboardShell activeItem="Overview">
        <div>Dashboard content</div>
      </DashboardShell>
    );

    expect(html).toContain('data-clerk-component="UserButton"');
    expect(html).toContain('data-clerk-component="OrganizationSwitcher"');
    expect(html).toContain('data-active-workspace-name="true"');
    expect(html).toContain("Personal workspace");
  });
});

describe("dashboard to API Clerk token integration", () => {
  it("forwards a Clerk bearer token through protected route handlers", async () => {
    const fetcher = vi.fn(
      async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) =>
        new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const response = await forwardDashboardApiMutation({
      method: "POST",
      path: "/api/github/installations/sync",
      body: { installationId: 123 },
      env: {
        NEXT_PUBLIC_API_URL: "http://dashboard-api.test",
        FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN: "session-token"
      },
      fetcher
    });
    const init = fetcher.mock.calls[0]![1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(response.status).toBe(200);
    expect(new URL(String(fetcher.mock.calls[0]![0])).pathname).toBe("/api/github/installations/sync");
    expect(headers.get("authorization")).toBe("Bearer session-token");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
  });

  it("returns a local 401 from protected route handlers before API calls when Clerk auth is missing", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const response = await forwardDashboardApiMutation({
      method: "POST",
      path: "/api/github/installations/sync",
      body: { installationId: 123 },
      env: {
        NEXT_PUBLIC_API_URL: "http://dashboard-api.test"
      },
      fetcher
    });

    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ message: expect.stringContaining("Clerk session") });
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function dashboardAuthEnv(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_API_URL: "http://dashboard-api.test",
    FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN: "session-token"
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function settingsResponse(role: "admin" | "developer") {
  return {
    workspace: {
      id: "workspace-1",
      name: "Firmcode",
      clerkOrgId: null,
      role,
      canManageSensitiveSettings: role === "admin"
    },
    clerk: {
      userProfileUrl: "https://accounts.clerk.example/user",
      organizationProfileUrl: "https://accounts.clerk.example/org",
      memberManagementUrl: "https://accounts.clerk.example/org/members"
    },
    githubApp: {
      installUrl: "https://github.com/apps/firmcode/installations/new",
      installations: [],
      repositoryConfigurationUrl: "/repositories"
    },
    retention: {
      artifactRetentionDays: 30,
      changedFilePatchDays: 14,
      fullSnapshotDays: 7,
      ciLogDays: 14,
      llmArtifactDays: 30,
      semgrepArtifactDays: 30,
      treeSitterArtifactDays: 30,
      findingMetadataDays: 90,
      aggregatedMetricDays: 180
    },
    apiKeys: {
      enabled: false,
      message: "Workspace API keys are planned and not enabled in the MVP."
    },
    notifications: {
      enabled: false,
      message: "Notifications are planned and not enabled in the MVP."
    }
  };
}

function withDashboardEnv(): () => void {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalToken = process.env.FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN;

  process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
  process.env.FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN = "session-token";

  return () => {
    restoreEnv("NEXT_PUBLIC_API_URL", originalApiUrl);
    restoreEnv("FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN", originalToken);
  };
}
