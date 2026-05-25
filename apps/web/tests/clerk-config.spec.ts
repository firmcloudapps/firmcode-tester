import { createWebClerkConfig } from "@firmcode/shared";

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
      billingPortalUrl: "https://accounts.clerk.example/billing"
    });
  });

  it("accepts explicit Clerk sign-in and sign-up routes", () => {
    const config = createWebClerkConfig({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up"
    });

    expect(config.signInUrl).toBe("/sign-in");
    expect(config.signUpUrl).toBe("/sign-up");
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
});
