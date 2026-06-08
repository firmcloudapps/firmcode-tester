import { requireAdminDashboardAccess, requireDeveloperDashboardAccess } from "../lib/dashboard-guards";
import { loadDashboardRole } from "../lib/dashboard-data";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  })
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("../lib/dashboard-data", () => ({
  loadDashboardRole: vi.fn()
}));

describe("dashboard role guards", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    vi.mocked(loadDashboardRole).mockReset();
  });

  it("redirects signed-out users away from admin and developer areas", async () => {
    vi.mocked(loadDashboardRole).mockResolvedValue({ status: "signed-out" });

    await expect(requireAdminDashboardAccess()).rejects.toThrow("redirect:/sign-in");
    await expect(requireDeveloperDashboardAccess()).rejects.toThrow("redirect:/sign-in");
  });

  it("blocks developers from admin routes", async () => {
    vi.mocked(loadDashboardRole).mockResolvedValue({ status: "ok", role: "developer" });

    await expect(requireAdminDashboardAccess()).rejects.toThrow("redirect:/dashboard/developer");
  });

  it("blocks admins from developer routes", async () => {
    vi.mocked(loadDashboardRole).mockResolvedValue({ status: "ok", role: "admin" });

    await expect(requireDeveloperDashboardAccess()).rejects.toThrow("redirect:/dashboard/admin");
  });

  it("allows the matching role through each guard", async () => {
    vi.mocked(loadDashboardRole)
      .mockResolvedValueOnce({ status: "ok", role: "admin" })
      .mockResolvedValueOnce({ status: "ok", role: "developer" });

    await expect(requireAdminDashboardAccess()).resolves.toBe("admin");
    await expect(requireDeveloperDashboardAccess()).resolves.toBe("developer");
  });
});
