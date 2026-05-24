import { Controller, Get, Headers } from "@nestjs/common";
import type { WorkspaceSettingsResponse } from "@firmcode/shared";
import { readDashboardRequestContext } from "../auth/dashboard-request-context";
import { SettingsService } from "./settings.service";

@Controller("api/settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getWorkspaceSettings(
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-clerk-org-id") clerkOrgIdHeader?: string | string[]
  ): Promise<WorkspaceSettingsResponse> {
    return this.settingsService.getWorkspaceSettings(
      readDashboardRequestContext({
        workspaceIdHeader,
        clerkUserIdHeader: userIdHeader,
        clerkOrgIdHeader
      })
    );
  }
}
