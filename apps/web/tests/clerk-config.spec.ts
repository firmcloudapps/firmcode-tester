import { createWebClerkConfig } from "@firmcode/shared";
import { loadWebClerkAuthRenderConfig } from "../config/clerk";

describe("web Clerk config", () => {
  it("validates the Clerk publishable key and billing portal entry point", () => {
    const config = createWebClerkConfig({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
      CLERK_BILLING_PORTAL_URL: "https://accounts.clerk.example/billing"
    });

    expect(config).toEqual({
      publishableKey: "pk_test_example",
      signInUrl: "/sign-in",
      signUpUrl: "/sign-up",
      afterSignInUrl: "/",
      afterSignUpUrl: "/",
      billingPortalUrl: "https://accounts.clerk.example/billing"
    });
  });

  it("accepts explicit Clerk sign-in, sign-up, and after-auth routes", () => {
    const config = createWebClerkConfig({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
      NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: "/repositories",
      NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: "/github/installations"
    });

    expect(config.signInUrl).toBe("/sign-in");
    expect(config.signUpUrl).toBe("/sign-up");
    expect(config.afterSignInUrl).toBe("/repositories");
    expect(config.afterSignUpUrl).toBe("/github/installations");
  });

  it("treats a missing billing portal URL as an unavailable Clerk Billing entry point", () => {
    const config = createWebClerkConfig({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example"
    });

    expect(config.billingPortalUrl).toBeNull();
  });

  it("fails when the Clerk publishable key is missing", () => {
    expect(() => createWebClerkConfig({})).toThrow(/NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required/);
  });

  it("rejects a relative billing portal URL", () => {
    expect(() =>
      createWebClerkConfig({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
        CLERK_BILLING_PORTAL_URL: "/billing"
      })
    ).toThrow(/CLERK_BILLING_PORTAL_URL must be an absolute/);
  });

  it("rejects invalid Clerk route values", () => {
    expect(() =>
      createWebClerkConfig({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
        NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: "dashboard"
      })
    ).toThrow(/NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL must be an absolute http\(s\) URL or app-relative path/);
  });
});

describe("web Clerk auth render config", () => {
  it("keeps sign-in rendering independent from optional billing configuration", () => {
    expect(
      loadWebClerkAuthRenderConfig({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
        CLERK_BILLING_PORTAL_URL: "/billing"
      })
    ).toEqual({
      publishableKey: "pk_test_example",
      signInUrl: "/sign-in",
      signUpUrl: "/sign-up",
      afterSignInUrl: "/auth/redirect",
      afterSignUpUrl: "/auth/redirect"
    });
  });

  it("falls back for malformed optional auth route values instead of breaking the public auth page", () => {
    expect(
      loadWebClerkAuthRenderConfig({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: "sign-in",
        NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: "dashboard"
      })
    ).toMatchObject({
      signInUrl: "/sign-in",
      afterSignInUrl: "/auth/redirect"
    });
  });
});
