import { Body, Controller, Get, Headers, Patch, Post, UseGuards } from "@nestjs/common";
import type { WorkspaceSettingsResponse } from "@firmcode/shared";
import { DashboardAuthGuard } from "../auth/dashboard-auth.guard";
import { SettingsService } from "./settings.service";

@Controller("api/settings")
@UseGuards(DashboardAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getWorkspaceSettings(
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<WorkspaceSettingsResponse> {
    return this.settingsService.getWorkspaceSettings({
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null
    });
  }

  @Patch("retention")
  async updateRetentionPolicy(
    @Body() body: unknown,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<never> {
    return this.settingsService.updateRetentionPolicy({
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null,
      body
    });
  }

  @Post("api-keys")
  async createApiKey(
    @Body() body: unknown,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<never> {
    return this.settingsService.createApiKey({
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null,
      body
    });
  }
}

function readSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === "" ? undefined : value;
}
