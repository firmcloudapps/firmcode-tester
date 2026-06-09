import { ForbiddenException, Inject, Injectable, NotFoundException, NotImplementedException, UnauthorizedException } from "@nestjs/common";
import type { WorkspaceSettingsMember, WorkspaceSettingsResponse } from "@firmcode/shared";
import {
  DASHBOARD_AUTH_STORE,
  roleHasDashboardCapability,
  type DashboardAuthStore
} from "../review-runs/dashboard-auth.store";
import { SETTINGS_STORE, type SettingsStore } from "./settings.store";

export interface WorkspaceSettingsRequestContext {
  readonly workspaceId: string | null;
  readonly userId: string | null;
}

export interface SensitiveWorkspaceSettingsRequestContext extends WorkspaceSettingsRequestContext {
  readonly body: unknown;
}

export interface WorkspaceMemberMutationRequestContext extends WorkspaceSettingsRequestContext {
  readonly targetUserId: string;
  readonly body: unknown;
}

@Injectable()
export class SettingsService {
  constructor(
    @Inject(SETTINGS_STORE) private readonly settingsStore: SettingsStore,
    @Inject(DASHBOARD_AUTH_STORE) private readonly dashboardAuthStore: DashboardAuthStore
  ) { }

  async getWorkspaceSettings(input: WorkspaceSettingsRequestContext): Promise<WorkspaceSettingsResponse> {
    assertAuthenticated(input);

    const membership = await this.dashboardAuthStore.findActiveMembership({
      workspaceId: input.workspaceId,
      userId: input.userId
    });

    if (membership === null) {
      throw new UnauthorizedException("Dashboard authentication is required");
    }

    const settings = await this.settingsStore.getWorkspaceSettings({
      workspaceId: membership.workspaceId,
      userId: membership.userId,
      role: membership.role
    });

    if (settings === null) {
      throw new NotFoundException("Workspace settings were not found");
    }

    return settings;
  }

  async updateRetentionPolicy(input: SensitiveWorkspaceSettingsRequestContext): Promise<never> {
    await this.authorizeSensitiveSettings(input);
    throw new NotImplementedException("Workspace retention changes are not enabled in the MVP");
  }

  async createApiKey(input: SensitiveWorkspaceSettingsRequestContext): Promise<never> {
    await this.authorizeSensitiveSettings(input);
    throw new NotImplementedException("Workspace API key creation is not enabled in the MVP");
  }

  async updateWorkspaceMemberRole(input: WorkspaceMemberMutationRequestContext): Promise<WorkspaceSettingsMember> {
    const membership = await this.authorizeSensitiveSettings(input);
    const role = readAssignableRole(input.body);

    await this.assertMemberMutationAllowed({
      workspaceId: membership.workspaceId,
      actorUserId: membership.userId,
      targetUserId: input.targetUserId,
      nextRole: role,
      nextActive: null
    });

    const updated = await this.settingsStore.updateWorkspaceMemberRole({
      workspaceId: membership.workspaceId,
      currentUserId: membership.userId,
      targetUserId: input.targetUserId,
      role
    });

    if (updated === null) {
      throw new NotFoundException("Workspace member was not found");
    }

    return updated;
  }

  async updateWorkspaceMemberStatus(input: WorkspaceMemberMutationRequestContext): Promise<WorkspaceSettingsMember> {
    const membership = await this.authorizeSensitiveSettings(input);
    const active = readActiveStatus(input.body);

    await this.assertMemberMutationAllowed({
      workspaceId: membership.workspaceId,
      actorUserId: membership.userId,
      targetUserId: input.targetUserId,
      nextRole: null,
      nextActive: active
    });

    const updated = await this.settingsStore.updateWorkspaceMemberStatus({
      workspaceId: membership.workspaceId,
      currentUserId: membership.userId,
      targetUserId: input.targetUserId,
      active
    });

    if (updated === null) {
      throw new NotFoundException("Workspace member was not found");
    }

    return updated;
  }

  private async authorizeSensitiveSettings(input: WorkspaceSettingsRequestContext) {
    assertAuthenticated(input);

    const membership = await this.dashboardAuthStore.findActiveMembership({
      workspaceId: input.workspaceId,
      userId: input.userId
    });

    if (membership === null) {
      throw new UnauthorizedException("Dashboard authentication is required");
    }

    if (!roleHasDashboardCapability(membership.role, "manage_sensitive_settings")) {
      throw new ForbiddenException("Workspace role cannot manage sensitive settings");
    }

    return membership;
  }

  private async assertMemberMutationAllowed(input: {
    readonly workspaceId: string;
    readonly actorUserId: string;
    readonly targetUserId: string;
    readonly nextRole: "admin" | "developer" | null;
    readonly nextActive: boolean | null;
  }): Promise<void> {
    if (input.actorUserId === input.targetUserId) {
      throw new ForbiddenException("Admins cannot change or suspend their own workspace membership");
    }

    const target = await this.settingsStore.getWorkspaceMember({
      workspaceId: input.workspaceId,
      currentUserId: input.actorUserId,
      targetUserId: input.targetUserId
    });

    if (target === null) {
      throw new NotFoundException("Workspace member was not found");
    }

    const removesActiveAdmin =
      target.active &&
      target.role === "admin" &&
      ((input.nextRole !== null && input.nextRole !== "admin") || input.nextActive === false);

    if (!removesActiveAdmin) {
      return;
    }

    const otherAdmins = await this.settingsStore.countOtherActiveAdmins({
      workspaceId: input.workspaceId,
      currentUserId: input.actorUserId,
      targetUserId: input.targetUserId
    });

    if (otherAdmins === 0) {
      throw new ForbiddenException("At least one active Admin must remain in the workspace");
    }
  }
}

function assertAuthenticated(input: WorkspaceSettingsRequestContext): asserts input is WorkspaceSettingsRequestContext & {
  workspaceId: string;
  userId: string;
} {
  if (input.workspaceId === null || input.userId === null) {
    throw new UnauthorizedException("Dashboard authentication is required");
  }
}

function readAssignableRole(body: unknown): "admin" | "developer" {
  const role = readRecordValue(body, "role");

  if (role === "admin" || role === "developer") {
    return role;
  }

  throw new ForbiddenException("Workspace member role must be admin or developer");
}

function readActiveStatus(body: unknown): boolean {
  const active = readRecordValue(body, "active");

  if (typeof active === "boolean") {
    return active;
  }

  throw new ForbiddenException("Workspace member active status must be a boolean");
}

function readRecordValue(body: unknown, key: string): unknown {
  if (body === null || typeof body !== "object") {
    return undefined;
  }

  return (body as Record<string, unknown>)[key];
}
