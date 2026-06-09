import { getAuthProvider, hasInsForgeConfig, loadWebInsForgeAuthRenderConfig } from "../config/insforge";

describe("web InsForge auth config", () => {
  it("loads InsForge auth routes with role-based redirect defaults", () => {
    expect(
      loadWebInsForgeAuthRenderConfig({
        NEXT_PUBLIC_INSFORGE_BASE_URL: "https://firmcode.eu-central.insforge.app",
        NEXT_PUBLIC_INSFORGE_ANON_KEY: "anon_test_key"
      })
    ).toEqual({
      baseUrl: "https://firmcode.eu-central.insforge.app",
      anonKey: "anon_test_key",
      signInUrl: "/sign-in",
      signUpUrl: "/sign-up",
      afterSignInUrl: "/auth/redirect",
      afterSignUpUrl: "/auth/redirect"
    });
  });

  it("accepts server InsForge env names for SSR session checks", () => {
    expect(
      loadWebInsForgeAuthRenderConfig({
        INSFORGE_BASE_URL: "https://firmcode.eu-central.insforge.app",
        INSFORGE_ANON_KEY: "anon_server_key"
      })
    ).toMatchObject({
      baseUrl: "https://firmcode.eu-central.insforge.app",
      anonKey: "anon_server_key"
    });
  });

  it("accepts the official public InsForge URL alias", () => {
    expect(
      loadWebInsForgeAuthRenderConfig({
        NEXT_PUBLIC_INSFORGE_URL: "https://firmcode.us-east.insforge.app",
        NEXT_PUBLIC_INSFORGE_ANON_KEY: "anon_test_key"
      })
    ).toMatchObject({
      baseUrl: "https://firmcode.us-east.insforge.app",
      anonKey: "anon_test_key"
    });
  });

  it("accepts explicit public auth routes", () => {
    const config = loadWebInsForgeAuthRenderConfig({
      NEXT_PUBLIC_INSFORGE_BASE_URL: "https://firmcode.eu-central.insforge.app",
      NEXT_PUBLIC_INSFORGE_ANON_KEY: "anon_test_key",
      NEXT_PUBLIC_INSFORGE_SIGN_IN_URL: "/login",
      NEXT_PUBLIC_INSFORGE_SIGN_UP_URL: "/register",
      NEXT_PUBLIC_INSFORGE_AFTER_SIGN_IN_URL: "/dashboard/developer",
      NEXT_PUBLIC_INSFORGE_AFTER_SIGN_UP_URL: "/github/installations"
    });

    expect(config.signInUrl).toBe("/login");
    expect(config.signUpUrl).toBe("/register");
    expect(config.afterSignInUrl).toBe("/dashboard/developer");
    expect(config.afterSignUpUrl).toBe("/github/installations");
  });

  it("detects whether the public InsForge config is complete", () => {
    expect(hasInsForgeConfig({})).toBe(false);
    expect(
      hasInsForgeConfig({
        NEXT_PUBLIC_INSFORGE_BASE_URL: "https://firmcode.eu-central.insforge.app",
        NEXT_PUBLIC_INSFORGE_ANON_KEY: "anon_test_key"
      })
    ).toBe(true);
    expect(
      hasInsForgeConfig({
        INSFORGE_BASE_URL: "https://firmcode.eu-central.insforge.app",
        INSFORGE_ANON_KEY: "anon_server_key"
      })
    ).toBe(true);
  });

  it("defaults the auth provider to InsForge unless an old InsForge flag is still set", () => {
    expect(getAuthProvider({})).toBe("insforge");
    expect(getAuthProvider({ NEXT_PUBLIC_AUTH_PROVIDER: "insforge" })).toBe("insforge");
    expect(getAuthProvider({ NEXT_PUBLIC_AUTH_PROVIDER: "insforge" })).toBe("insforge");
  });
});
