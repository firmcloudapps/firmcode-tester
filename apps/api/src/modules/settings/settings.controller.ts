import { Controller, Get, Headers } from "@nestjs/common";
import type { WorkspaceSettingsResponse } from "@firmcode/shared";
import { SettingsService } from "./settings.service";

@Controller("api/settings")
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
}

function readSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === "" ? undefined : value;
}
