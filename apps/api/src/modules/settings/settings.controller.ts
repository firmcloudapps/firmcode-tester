import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import type { WorkspaceSettingsResponse } from "@firmcode/shared";
import {
  DashboardAuth,
  toDashboardServiceAuth,
  type DashboardAuthParam,
  type DashboardRequestContext
} from "../auth/dashboard-auth.context";
import { DashboardAuthGuard } from "../auth/dashboard-auth.guard";
import { SettingsService } from "./settings.service";

@Controller("api/settings")
@UseGuards(DashboardAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getWorkspaceSettings(
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<WorkspaceSettingsResponse> {
    return this.settingsService.getWorkspaceSettings({
      ...readServiceAuth(auth, userIdHeader)
    });
  }

  @Patch("retention")
  async updateRetentionPolicy(
    @Body() body: unknown,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<never> {
    return this.settingsService.updateRetentionPolicy({
      ...readServiceAuth(auth, userIdHeader),
      body
    });
  }

  @Post("api-keys")
  async createApiKey(
    @Body() body: unknown,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<never> {
    return this.settingsService.createApiKey({
      ...readServiceAuth(auth, userIdHeader),
      body
    });
  }
}

function readServiceAuth(auth: DashboardAuthParam, userIdHeader: string | string[] | undefined) {
  if (typeof auth === "object" && auth !== null && !Array.isArray(auth) && "workspaceId" in auth) {
    return toDashboardServiceAuth(auth as DashboardRequestContext);
  }

  return {
    workspaceId: readSingleValue(auth) ?? null,
    clerkUserId: readSingleValue(userIdHeader) ?? null
  };
}

function readSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === "" ? undefined : value;
}
