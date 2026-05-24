import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { roleHasDashboardCapability, type DashboardCapability, type DashboardWorkspaceRole } from "@firmcode/shared";
import { DASHBOARD_AUTH_STORE, type DashboardAuthStore } from "./dashboard-auth.store";

export interface DashboardRequestContext {
  readonly clerkUserId: string | null;
  readonly workspaceId: string | null;
  readonly clerkOrgId?: string | null;
}

export interface AuthorizedDashboardContext {
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly clerkOrgId: string | null;
  readonly clerkUserId: string;
  readonly role: DashboardWorkspaceRole;
}

export interface DashboardAuthorizationOptions {
  readonly capability?: DashboardCapability;
  readonly concealMembershipFailure?: boolean;
  readonly notFoundMessage?: string;
  readonly forbiddenMessage?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class DashboardAuthorizationService {
  constructor(@Inject(DASHBOARD_AUTH_STORE) private readonly dashboardAuthStore: DashboardAuthStore) {}

  async requireWorkspaceMembership(
    input: DashboardRequestContext,
    options: DashboardAuthorizationOptions = {}
  ): Promise<AuthorizedDashboardContext> {
    const clerkUserId = normalizeOptional(input.clerkUserId);

    if (clerkUserId === null) {
      throw new UnauthorizedException("Dashboard authentication is required");
    }

    const workspaceId = await this.resolveWorkspaceId({
      workspaceId: normalizeOptional(input.workspaceId),
      clerkOrgId: normalizeOptional(input.clerkOrgId)
    });
    const membership = await this.dashboardAuthStore.findActiveMembership({
      workspaceId,
      clerkUserId
    });

    if (membership === null) {
      if (options.concealMembershipFailure === true) {
        throw new NotFoundException(options.notFoundMessage ?? "Resource not found");
      }

      throw new UnauthorizedException("Dashboard workspace membership is required");
    }

    if (options.capability !== undefined && !roleHasDashboardCapability(membership.role, options.capability)) {
      throw new ForbiddenException(options.forbiddenMessage ?? "Workspace role is not authorized for this action");
    }

    return {
      workspaceId: membership.workspaceId,
      workspaceName: membership.workspaceName,
      clerkOrgId: membership.clerkOrgId,
      clerkUserId: membership.clerkUserId,
      role: membership.role
    };
  }

  private async resolveWorkspaceId(input: { workspaceId: string | null; clerkOrgId: string | null }): Promise<string> {
    if (input.workspaceId !== null) {
      if (!UUID_PATTERN.test(input.workspaceId)) {
        throw new BadRequestException("workspace ID must be a UUID");
      }

      const workspace = await this.dashboardAuthStore.findWorkspaceById(input.workspaceId);

      if (workspace === null) {
        throw new UnauthorizedException("Dashboard workspace membership is required");
      }

      return workspace.id;
    }

    if (input.clerkOrgId !== null) {
      const workspace = await this.dashboardAuthStore.findWorkspaceByClerkOrgId(input.clerkOrgId);

      if (workspace === null) {
        throw new UnauthorizedException("Dashboard workspace membership is required");
      }

      return workspace.id;
    }

    throw new UnauthorizedException("Dashboard workspace context is required");
  }
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value.trim() === "") {
    return null;
  }

  return value;
}
