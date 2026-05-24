import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { WorkspaceSettingsResponse } from "@firmcode/shared";
import {
  DashboardAuthorizationService,
  type DashboardRequestContext
} from "../auth/dashboard-authorization.service";
import { SETTINGS_STORE, type SettingsStore } from "./settings.store";

export type WorkspaceSettingsRequestContext = DashboardRequestContext;

@Injectable()
export class SettingsService {
  constructor(
    @Inject(SETTINGS_STORE) private readonly settingsStore: SettingsStore,
    private readonly dashboardAuthorization: DashboardAuthorizationService
  ) {}

  async getWorkspaceSettings(input: WorkspaceSettingsRequestContext): Promise<WorkspaceSettingsResponse> {
    const context = await this.dashboardAuthorization.requireWorkspaceMembership(input, {
      capability: "view_workspace_settings"
    });

    const settings = await this.settingsStore.getWorkspaceSettings({
      workspaceId: context.workspaceId,
      clerkUserId: context.clerkUserId,
      role: context.role
    });

    if (settings === null) {
      throw new NotFoundException("Workspace settings were not found");
    }

    return settings;
  }
}
