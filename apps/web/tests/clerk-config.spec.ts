import { createWebClerkConfig } from "@firmcode/shared";

describe("web Clerk config", () => {
  it("validates the Clerk publishable key and billing portal entry point", () => {
    const config = createWebClerkConfig({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
      CLERK_BILLING_PORTAL_URL: "https://accounts.clerk.example/billing"
    });

    expect(config).toEqual({
      publishableKey: "pk_test_example",
      billingPortalUrl: "https://accounts.clerk.example/billing"
    });
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
