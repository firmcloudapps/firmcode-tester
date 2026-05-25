import React from "react";
import { renderToString } from "react-dom/server";
import SignInPage from "../app/sign-in/[[...sign-in]]/page";
import SignUpPage from "../app/sign-up/[[...sign-up]]/page";
import { DashboardShell } from "../components/dashboard/dashboard-shell";
import { forwardDashboardApiMutation } from "../lib/dashboard-api-proxy";
import { isProtectedDashboardPath, PROTECTED_DASHBOARD_ROUTES } from "../lib/protected-routes";
import middlewareConfig from "../middleware";
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
    expect(nextMiddlewareConfig.matcher).toEqual(["/((?!_next|.*\\..*).*)"]);
    expect(middlewareConfig).toBeTypeOf("function");
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
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const response = await forwardDashboardApiMutation({
      method: "POST",
      path: "/api/github/installations/sync",
      body: { installationId: 123 },
      env: {
        NEXT_PUBLIC_API_URL: "http://dashboard-api.test",
        FIRMCODE_DASHBOARD_CLERK_TOKEN: "session-token"
      },
      fetcher
    });
    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(response.status).toBe(200);
    expect(new URL(String(fetcher.mock.calls[0]?.[0])).pathname).toBe("/api/github/installations/sync");
    expect(headers.get("authorization")).toBe("Bearer session-token");
    expect(headers.get("x-firmcode-user-id")).toBeNull();
  });
});
