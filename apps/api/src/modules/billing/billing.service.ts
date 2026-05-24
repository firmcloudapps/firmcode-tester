import { ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { WorkspaceBillingResponse } from "@firmcode/shared";
import {
  DASHBOARD_AUTH_STORE,
  roleHasDashboardCapability,
  type DashboardAuthStore
} from "../review-runs/dashboard-auth.store";

export interface WorkspaceBillingRequestContext {
  readonly workspaceId: string | null;
  readonly clerkUserId: string | null;
  readonly hasClerkBillingCapability: boolean;
}

@Injectable()
export class BillingService {
  constructor(@Inject(DASHBOARD_AUTH_STORE) private readonly dashboardAuthStore: DashboardAuthStore) {}

  async getWorkspaceBilling(input: WorkspaceBillingRequestContext): Promise<WorkspaceBillingResponse> {
    assertAuthenticated(input);

    const membership = await this.dashboardAuthStore.findActiveMembership({
      workspaceId: input.workspaceId,
      clerkUserId: input.clerkUserId
    });

    if (membership === null) {
      throw new UnauthorizedException("Dashboard authentication is required");
    }

    const canManage = roleHasDashboardCapability(membership.role, "manage_billing", {
      hasClerkBillingCapability: input.hasClerkBillingCapability
    });

    if (!canManage) {
      throw new ForbiddenException("Workspace role cannot manage billing");
    }

    return {
      workspace: {
        id: membership.workspaceId,
        role: membership.role,
        canManageBilling: true,
        source: "clerk"
      },
      plan: {
        name: "Clerk managed",
        status: "managed_by_clerk"
      },
      usage: {
        reviewRunsThisMonth: null,
        aiTokensThisMonth: null,
        repositoriesMonitored: null,
        seats: null
      }
    };
  }
}

function assertAuthenticated(input: WorkspaceBillingRequestContext): asserts input is WorkspaceBillingRequestContext & {
  workspaceId: string;
  clerkUserId: string;
} {
  if (input.workspaceId === null || input.clerkUserId === null) {
    throw new UnauthorizedException("Dashboard authentication is required");
  }
}
