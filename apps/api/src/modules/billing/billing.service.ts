import { ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { canManageWorkspaceBilling, type WorkspaceBillingResponse } from "@firmcode/shared";
import { DASHBOARD_AUTH_STORE, type DashboardAuthStore } from "../review-runs/dashboard-auth.store";
import { BILLING_STORE, type BillingStore } from "./billing.store";

export interface WorkspaceBillingRequestContext {
  readonly workspaceId: string | null;
  readonly clerkUserId: string | null;
  readonly hasClerkManagedBillingRole: boolean;
}

@Injectable()
export class BillingService {
  constructor(
    @Inject(BILLING_STORE) private readonly billingStore: BillingStore,
    @Inject(DASHBOARD_AUTH_STORE) private readonly dashboardAuthStore: DashboardAuthStore
  ) {}

  async getWorkspaceBilling(input: WorkspaceBillingRequestContext): Promise<WorkspaceBillingResponse> {
    assertAuthenticated(input);

    const membership = await this.dashboardAuthStore.findActiveMembership({
      workspaceId: input.workspaceId,
      clerkUserId: input.clerkUserId
    });

    if (membership === null) {
      throw new UnauthorizedException("Dashboard authentication is required");
    }

    if (!canManageWorkspaceBilling(membership.role, input.hasClerkManagedBillingRole)) {
      throw new ForbiddenException("Billing access requires workspace Owner/Admin or Clerk billing role");
    }

    const billing = await this.billingStore.getWorkspaceBilling({
      workspaceId: membership.workspaceId,
      role: membership.role,
      hasClerkManagedBillingRole: input.hasClerkManagedBillingRole
    });

    if (billing === null) {
      throw new NotFoundException("Workspace billing summary was not found");
    }

    return billing;
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
