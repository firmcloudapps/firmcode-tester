import React from "react";
import { renderToString } from "react-dom/server";
import { AuthPage } from "../components/auth/auth-page";
import { DashboardShell } from "../components/dashboard/dashboard-shell";
import { InsForgeProviderBoundary } from "../components/insforge-provider-boundary";
import {
  DEFAULT_CLERK_ORGANIZATION_ID,
  ensureDefaultClerkOrganizationMembership,
  readDefaultClerkOrganizationMembershipConfig
} from "../lib/default-clerk-organization";
import { forwardDashboardApiMutation } from "../lib/dashboard-api-proxy";

describe("auth foundation compatibility", () => {
  it("renders public sign-in and sign-up pages without the dashboard shell", () => {
    const signInHtml = renderToString(
      <InsForgeProviderBoundary>
        <AuthPage mode="sign-in" />
      </InsForgeProviderBoundary>
    );
    const signUpHtml = renderToString(
      <InsForgeProviderBoundary>
        <AuthPage mode="sign-up" />
      </InsForgeProviderBoundary>
    );

    expect(signInHtml).toContain("Sign in to Firmcode");
    expect(signInHtml).not.toContain('data-clerk-authenticated="required"');
    expect(signInHtml).toContain("Continue with Google");
    expect(signUpHtml).toContain("Create your Firmcode workspace");
    expect(signUpHtml).toContain("Create account");
    expect(signUpHtml).toContain("Sign up with Google");
  });

  it("renders dashboard account controls without restoring Clerk organization switching", () => {
    const html = renderToString(
      <DashboardShell activeItem="PR Review">
        <div>Dashboard content</div>
      </DashboardShell>
    );

    expect(html).toContain('data-clerk-component="UserButton"');
    expect(html).not.toContain('data-clerk-component="OrganizationSwitcher"');
    expect(html).toContain('data-active-workspace-name="true"');
    expect(html).toContain("Personal workspace");
  });

  it("returns a local signed-out response before proxying protected dashboard mutations", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const response = await forwardDashboardApiMutation({
      method: "POST",
      path: "/api/github/installations/sync",
      body: { installationId: 123 },
      env: { NODE_ENV: "test" },
      fetcher
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ message: expect.stringContaining("signed-in session") });
  });

  it("forwards the explicit dashboard session token override for protected mutations", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await forwardDashboardApiMutation({
      method: "POST",
      path: "/api/github/installations/sync",
      body: { installationId: 123 },
      env: {
        NODE_ENV: "test",
        NEXT_PUBLIC_API_URL: "http://dashboard-api.test",
        FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN: "session-token",
        FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID: "workspace-1"
      },
      fetcher
    });

    const calls = fetcher.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
    const headers = new Headers(calls[0]?.[1]?.headers);

    expect(headers.get("authorization")).toBe("Bearer session-token");
    expect(headers.get("x-firmcode-workspace-id")).toBe("workspace-1");
  });
});

describe("legacy default workspace compatibility", () => {
  it("keeps the historical default workspace identifiers available", () => {
    expect(readDefaultClerkOrganizationMembershipConfig({ NODE_ENV: "development" })).toMatchObject({
      organizationId: DEFAULT_CLERK_ORGANIZATION_ID,
      organizationName: "Firmcode AI",
      role: "org:developer"
    });
  });

  it("treats the legacy default organization membership hook as a no-op", async () => {
    await expect(
      ensureDefaultClerkOrganizationMembership({
        userId: "user_new",
        config: {
          organizationId: DEFAULT_CLERK_ORGANIZATION_ID,
          organizationName: "Firmcode AI",
          role: "org:developer"
        }
      })
    ).resolves.toMatchObject({
      status: "skipped",
      organizationId: DEFAULT_CLERK_ORGANIZATION_ID,
      userId: "user_new",
      role: "org:developer",
      reason: null
    });
  });
});
