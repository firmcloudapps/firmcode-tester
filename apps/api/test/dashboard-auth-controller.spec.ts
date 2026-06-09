import { DashboardAuthController } from "../src/modules/auth/dashboard-auth.controller";
import type { DashboardRequestContext } from "../src/modules/auth/dashboard-auth.context";

describe("DashboardAuthController", () => {
  it("returns the verified InsForge user and database-resolved workspace role", () => {
    const controller = new DashboardAuthController();

    expect(controller.getCurrentDashboardUser(authContext)).toEqual({
      user: {
        id: "usr_insforge_1",
        email: "kelly@example.com",
        emailVerified: true,
        provider: "insforge"
      },
      profile: {
        id: "usr_insforge_1",
        identityProvider: "insforge",
        providerUserId: "usr_insforge_1",
        email: "kelly@example.com",
        emailVerified: true
      },
      workspace: {
        id: "00000000-0000-4000-8000-000000000101",
        identityWorkspaceId: null,
        role: "developer"
      },
      capabilities: ["retry_review_run"]
    });
  });
});

const authContext: DashboardRequestContext = {
  userId: "usr_insforge_1",
  orgId: null,
  sessionId: "sess_1",
  workspaceId: "00000000-0000-4000-8000-000000000101",
  role: "developer",
  capabilities: ["retry_review_run"],
  billingCapabilities: [],
  email: "kelly@example.com",
  emailVerified: true,
  provider: "insforge"
};
