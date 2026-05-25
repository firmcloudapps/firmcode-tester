import React from "react";
import { renderToString } from "react-dom/server";
import SignInPage from "../app/sign-in/[[...sign-in]]/page";
import SignUpPage from "../app/sign-up/[[...sign-up]]/page";
import { clerkAppearance } from "../components/auth/auth-page";
import { DashboardShell } from "../components/dashboard/dashboard-shell";
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
  it("renders the sign-in route with the dedicated auth-page shell", () => {
    const html = renderToString(<SignInPage />);

    expect(html).toContain('data-auth-page="sign-in"');
    expect(html).toContain("PR review workspace");
    expect(html).toContain('data-auth-panel="true"');
    expect(html).toContain('data-clerk-component="SignIn"');
    expect(html).not.toContain('data-clerk-authenticated="required"');
  });

  it("renders the sign-up route with the same constrained responsive layout", () => {
    const html = renderToString(<SignUpPage />);

    expect(html).toContain('data-auth-page="sign-up"');
    expect(html).toContain("Create your Firmcode workspace");
    expect(html).toContain("max-w-[460px]");
    expect(html).toContain("md:grid-cols-[minmax(0,0.9fr)_minmax(400px,460px)]");
    expect(html).toContain('data-clerk-component="SignUp"');
  });

  it("keeps Clerk appearance hooks compact and dashboard-token aligned", () => {
    expect(clerkAppearance.elements.cardBox).toContain("border-border");
    expect(clerkAppearance.elements.cardBox).toContain("rounded-lg");
    expect(clerkAppearance.elements.formButtonPrimary).toContain("bg-accent");
    expect(clerkAppearance.elements.formButtonPrimary).toContain("focus:ring-accent");
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
