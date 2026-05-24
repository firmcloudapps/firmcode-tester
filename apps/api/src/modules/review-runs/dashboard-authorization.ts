import { ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import {
  roleHasDashboardCapability,
  type DashboardAuthStore,
  type DashboardCapability,
  type DashboardMembership
} from "./dashboard-auth.store";

export interface DashboardRequestHeaders {
  readonly workspaceId: string | null;
  readonly clerkUserId: string | null;
}

export async function authorizeDashboardRequest(
  authStore: DashboardAuthStore,
  input: DashboardRequestHeaders,
  capability: DashboardCapability = "view_dashboard"
): Promise<DashboardMembership> {
  assertAuthenticated(input);

  const membership = await authStore.findActiveMembership({
    workspaceId: input.workspaceId,
    clerkUserId: input.clerkUserId
  });

  if (membership === null) {
    throw new NotFoundException("Dashboard resource not found");
  }

  if (!roleHasDashboardCapability(membership.role, capability)) {
    throw new ForbiddenException("Workspace role cannot access this dashboard resource");
  }

  return membership;
}

export function readSingleHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] === "" ? null : value[0];
  }

  return value === undefined || value === "" ? null : value;
}

function assertAuthenticated(input: DashboardRequestHeaders): asserts input is {
  readonly workspaceId: string;
  readonly clerkUserId: string;
} {
  if (input.workspaceId === null || input.clerkUserId === null) {
    throw new UnauthorizedException("Dashboard authentication is required");
  }
}
