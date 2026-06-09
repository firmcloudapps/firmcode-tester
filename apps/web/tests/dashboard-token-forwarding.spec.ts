describe("dashboard session token forwarding", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("reads the explicit non-production dashboard session token override", async () => {
    const { getDashboardApiBearerToken } = await import("../lib/dashboard-auth");

    await expect(
      getDashboardApiBearerToken({
        NODE_ENV: "test",
        FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN: "session-token"
      })
    ).resolves.toBe("session-token");
  });

  it("treats missing request auth context as signed out", async () => {
    const { getDashboardApiBearerToken } = await import("../lib/dashboard-auth");

    await expect(getDashboardApiBearerToken({ NODE_ENV: "test" })).resolves.toBeNull();
  });
});
