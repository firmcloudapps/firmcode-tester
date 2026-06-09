import { NextRequest } from "next/server";
import { GET as startGoogleOAuth } from "../app/api/auth/google/route";
import { GET as completeInsForgeOAuth } from "../app/api/auth/callback/route";
import { POST as refreshInsForgeSession } from "../app/api/auth/refresh/route";
import { POST as signInWithPassword } from "../app/api/auth/sign-in/route";

const sdkMocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  exchangeOAuthCode: vi.fn(),
  signInWithPassword: vi.fn(),
  refreshAuth: vi.fn(),
  clearAuthCookies: vi.fn(),
  setAuthCookies: vi.fn((cookies: { set: (name: string, value: string, options?: Record<string, unknown>) => void }, tokens: { accessToken: string; refreshToken?: string | null }) => {
    cookies.set("insforge_access_token", tokens.accessToken, { path: "/" });
    if (tokens.refreshToken) {
      cookies.set("insforge_refresh_token", tokens.refreshToken, { path: "/", httpOnly: true });
    }
  })
}));

vi.mock("@insforge/sdk/ssr", () => ({
  createServerClient: () => ({
    auth: {
      signInWithOAuth: sdkMocks.signInWithOAuth,
      exchangeOAuthCode: sdkMocks.exchangeOAuthCode,
      signInWithPassword: sdkMocks.signInWithPassword
    }
  }),
  clearAuthCookies: sdkMocks.clearAuthCookies,
  DEFAULT_REFRESH_TOKEN_COOKIE: "insforge_refresh_token",
  refreshAuth: sdkMocks.refreshAuth,
  setAuthCookies: sdkMocks.setAuthCookies
}));

describe("InsForge SSR auth routes", () => {
  const originalDashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL;

  beforeEach(() => {
    sdkMocks.signInWithOAuth.mockReset();
    sdkMocks.exchangeOAuthCode.mockReset();
    sdkMocks.signInWithPassword.mockReset();
    sdkMocks.refreshAuth.mockReset();
    sdkMocks.clearAuthCookies.mockReset();
    sdkMocks.setAuthCookies.mockClear();
  });

  afterEach(() => {
    if (originalDashboardUrl === undefined) {
      delete process.env.NEXT_PUBLIC_DASHBOARD_URL;
    } else {
      process.env.NEXT_PUBLIC_DASHBOARD_URL = originalDashboardUrl;
    }
  });

  it("starts Google OAuth server-side and stores the PKCE verifier in an httpOnly cookie", async () => {
    process.env.NEXT_PUBLIC_DASHBOARD_URL = "https://firmcode.test";
    sdkMocks.signInWithOAuth.mockResolvedValue({
      data: {
        url: "https://insforge.test/oauth/google",
        codeVerifier: "pkce-verifier"
      },
      error: null
    });

    const response = await startGoogleOAuth(new NextRequest("https://firmcode.test/api/auth/google"));

    expect(sdkMocks.signInWithOAuth).toHaveBeenCalledWith("google", {
      redirectTo: "https://firmcode.test/api/auth/callback",
      skipBrowserRedirect: true,
      additionalParams: {
        prompt: "select_account"
      }
    });
    expect(response.headers.get("location")).toBe("https://insforge.test/oauth/google");
    expect(response.headers.get("set-cookie")).toContain("insforge_code_verifier=pkce-verifier");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("canonicalizes local OAuth starts before creating the PKCE verifier cookie", async () => {
    process.env.NEXT_PUBLIC_DASHBOARD_URL = "http://localhost:3000";

    const response = await startGoogleOAuth(
      new NextRequest("http://127.0.0.1:3000/api/auth/google", {
        headers: {
          host: "127.0.0.1:3000"
        }
      })
    );

    expect(response.headers.get("location")).toBe("http://localhost:3000/api/auth/google");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(sdkMocks.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("exchanges the InsForge OAuth code server-side and redirects through role routing", async () => {
    process.env.NEXT_PUBLIC_DASHBOARD_URL = "https://firmcode.test";
    sdkMocks.exchangeOAuthCode.mockResolvedValue({
      data: {
        user: { id: "usr_google", email: "kelly@example.com", emailVerified: true },
        accessToken: "access-token",
        refreshToken: "refresh-token"
      },
      error: null
    });

    const response = await completeInsForgeOAuth(
      new NextRequest("https://firmcode.test/api/auth/callback?insforge_code=oauth-code", {
        headers: {
          cookie: "insforge_code_verifier=pkce-verifier"
        }
      })
    );

    expect(sdkMocks.exchangeOAuthCode).toHaveBeenCalledWith("oauth-code", "pkce-verifier");
    expect(sdkMocks.setAuthCookies).toHaveBeenCalledWith(expect.anything(), {
      accessToken: "access-token",
      refreshToken: "refresh-token"
    }, {
      options: {
        accessToken: { secure: true },
        refreshToken: { secure: true }
      }
    });
    expect(response.headers.get("location")).toBe("https://firmcode.test/auth/redirect");
  });

  it("sets SSR auth cookies for email/password sign-in", async () => {
    process.env.NEXT_PUBLIC_DASHBOARD_URL = "https://firmcode.test";
    sdkMocks.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: "usr_password", email: "kelly@example.com", emailVerified: true },
        accessToken: "access-token",
        refreshToken: "refresh-token"
      },
      error: null
    });

    const response = await signInWithPassword(
      new Request("https://firmcode.test/api/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({
          email: "kelly@example.com",
          password: "password-123"
        })
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      user: {
        id: "usr_password",
        email: "kelly@example.com"
      }
    });
    expect(sdkMocks.signInWithPassword).toHaveBeenCalledWith({
      email: "kelly@example.com",
      password: "password-123"
    });
    expect(sdkMocks.setAuthCookies).toHaveBeenCalledWith(expect.anything(), {
      accessToken: "access-token",
      refreshToken: "refresh-token"
    }, {
      options: {
        accessToken: { secure: true },
        refreshToken: { secure: true }
      }
    });
  });

  it("sets non-secure SSR auth cookies for local HTTP Docker sign-in", async () => {
    process.env.NEXT_PUBLIC_DASHBOARD_URL = "http://localhost:3000";
    sdkMocks.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: "usr_password", email: "kelly@example.com", emailVerified: true },
        accessToken: "access-token",
        refreshToken: "refresh-token"
      },
      error: null
    });

    await signInWithPassword(
      new Request("http://localhost:3000/api/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({
          email: "kelly@example.com",
          password: "password-123"
        })
      })
    );

    expect(sdkMocks.setAuthCookies).toHaveBeenCalledWith(expect.anything(), {
      accessToken: "access-token",
      refreshToken: "refresh-token"
    }, {
      options: {
        accessToken: { secure: false },
        refreshToken: { secure: false }
      }
    });
  });

  it("does not call InsForge refresh when the local refresh cookie is missing", async () => {
    process.env.NEXT_PUBLIC_DASHBOARD_URL = "http://localhost:3000";

    const response = await refreshInsForgeSession(
      new NextRequest("http://localhost:3000/api/auth/refresh", {
        method: "POST"
      })
    );

    expect(response.status).toBe(204);
    expect(sdkMocks.refreshAuth).not.toHaveBeenCalled();
    expect(sdkMocks.clearAuthCookies).toHaveBeenCalledWith(expect.anything(), {
      options: {
        accessToken: { secure: false },
        refreshToken: { secure: false }
      }
    });
  });
});
