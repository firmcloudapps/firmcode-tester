describe("Clerk session token forwarding", () => {
  afterEach(() => {
    vi.doUnmock("@clerk/nextjs/server");
    vi.resetModules();
  });

  it("requests the configured Clerk JWT template for web-to-API bearer tokens", async () => {
    const getToken = vi.fn(async () => "clerk-session-token");

    vi.doMock("@clerk/nextjs/server", () => ({
      auth: vi.fn(async () => ({
        userId: "user_123",
        sessionId: "sess_123",
        getToken
      }))
    }));

    const { getClerkApiBearerToken } = await import("../lib/clerk-auth");

    await expect(getClerkApiBearerToken({ CLERK_JWT_AUDIENCE: "firmcode-api" })).resolves.toBe("clerk-session-token");
    expect(getToken).toHaveBeenCalledWith({ template: "firmcode-api" });
  });

  it("treats missing Clerk user or session state as unauthenticated", async () => {
    vi.doMock("@clerk/nextjs/server", () => ({
      auth: vi.fn(async () => ({
        userId: null,
        sessionId: null,
        getToken: vi.fn(async () => "token-without-session")
      }))
    }));

    const { getClerkApiBearerToken } = await import("../lib/clerk-auth");

    await expect(getClerkApiBearerToken({ CLERK_JWT_AUDIENCE: "firmcode-api" })).resolves.toBeNull();
  });
});
