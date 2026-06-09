import { UnauthorizedException } from "@nestjs/common";
import {
  resolveDashboardMembership,
  toDashboardServiceAuth,
  type DashboardRequestContext
} from "../src/modules/auth/dashboard-auth.context";
import type { DashboardAuthStore } from "../src/modules/review-runs/dashboard-auth.store";

describe("dashboard auth context helpers", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("rejects caller-supplied identity fallbacks outside isolated tests", async () => {
    process.env.NODE_ENV = "production";
    const store: DashboardAuthStore = {
      async findActiveMembership() {
        return {
          workspaceId: "workspace-from-header",
          userId: "user-from-header",
          role: "admin"
        };
      }
    };

    expect(() => toDashboardServiceAuth("workspace-from-header", "user-from-header")).toThrow(UnauthorizedException);
    await expect(
      resolveDashboardMembership("workspace-from-header", "user-from-header", store, "Resource not found")
    ).rejects.toThrow(UnauthorizedException);
  });

  it("uses only guard-populated provider context for production service auth", () => {
    process.env.NODE_ENV = "production";
    const auth: DashboardRequestContext = {
      workspaceId: "workspace-from-token",
      userId: "user-from-token",
      orgId: "org_from_token",
      sessionId: "sess_from_token",
      role: "developer",
      capabilities: [],
      billingCapabilities: [],
      provider: "insforge"
    };

    expect(toDashboardServiceAuth(auth, "user-from-header")).toEqual({
      workspaceId: "workspace-from-token",
      userId: "user-from-token"
    });
  });
});
