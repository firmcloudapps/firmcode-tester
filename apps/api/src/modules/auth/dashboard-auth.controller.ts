import { Controller, Get, UseGuards } from "@nestjs/common";
import type { DashboardAuthMeResponse } from "@firmcode/shared";
import { DashboardAuth, type DashboardRequestContext } from "./dashboard-auth.context";
import { DashboardAuthGuard } from "./dashboard-auth.guard";

@Controller("api/auth")
@UseGuards(DashboardAuthGuard)
export class DashboardAuthController {
  @Get("me")
  getCurrentDashboardUser(@DashboardAuth() auth: DashboardRequestContext): DashboardAuthMeResponse {
    return {
      user: {
        id: auth.userId,
        email: auth.email,
        emailVerified: auth.emailVerified,
        provider: "insforge"
      },
      profile: {
        id: auth.userId,
        identityProvider: "insforge",
        providerUserId: auth.userId,
        email: auth.email,
        emailVerified: auth.emailVerified
      },
      workspace: {
        id: auth.workspaceId,
        identityWorkspaceId: auth.orgId,
        role: auth.role
      },
      capabilities: [...auth.capabilities]
    };
  }
}
