import { Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { WorkspaceSettingsResponse } from "@firmcode/shared";
import { DASHBOARD_AUTH_STORE, type DashboardAuthStore } from "../review-runs/dashboard-auth.store";
import { SETTINGS_STORE, type SettingsStore } from "./settings.store";

export interface WorkspaceSettingsRequestContext {
  readonly workspaceId: string | null;
  readonly clerkUserId: string | null;
}

@Injectable()
export class SettingsService {
  constructor(
    @Inject(SETTINGS_STORE) private readonly settingsStore: SettingsStore,
    @Inject(DASHBOARD_AUTH_STORE) private readonly dashboardAuthStore: DashboardAuthStore
  ) {}

  async getWorkspaceSettings(input: WorkspaceSettingsRequestContext): Promise<WorkspaceSettingsResponse> {
    assertAuthenticated(input);

    const membership = await this.dashboardAuthStore.findActiveMembership({
      workspaceId: input.workspaceId,
      clerkUserId: input.clerkUserId
    });

    if (membership === null) {
      throw new UnauthorizedException("Dashboard authentication is required");
    }

    const settings = await this.settingsStore.getWorkspaceSettings({
      workspaceId: membership.workspaceId,
      clerkUserId: membership.clerkUserId,
      role: membership.role
    });

    if (settings === null) {
      throw new NotFoundException("Workspace settings were not found");
    }

    return settings;
  }
}

function assertAuthenticated(input: WorkspaceSettingsRequestContext): asserts input is WorkspaceSettingsRequestContext & {
  workspaceId: string;
  clerkUserId: string;
} {
  if (input.workspaceId === null || input.clerkUserId === null) {
    throw new UnauthorizedException("Dashboard authentication is required");
  }
}
