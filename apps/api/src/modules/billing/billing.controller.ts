import { Controller, Get, UseGuards } from "@nestjs/common";
import type { WorkspaceBillingResponse } from "@firmcode/shared";
import {
  DashboardAuth,
  isDashboardRequestContext,
  toDashboardServiceAuth,
  type DashboardAuthParam
} from "../auth/dashboard-auth.context";
import { DashboardAuthGuard } from "../auth/dashboard-auth.guard";
import { hasClerkManagedBillingCapability } from "../review-runs/dashboard-auth.store";
import { BillingService } from "./billing.service";

@Controller("api/billing")
@UseGuards(DashboardAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  async getWorkspaceBilling(
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[],
    billingCapabilityHeader?: string | string[]
  ): Promise<WorkspaceBillingResponse> {
    const serviceAuth = readServiceAuth(auth, userIdHeader);

    return this.billingService.getWorkspaceBilling({
      ...serviceAuth,
      hasClerkBillingCapability:
        (isDashboardRequestContext(auth) && auth.capabilities.includes("manage_billing")) ||
        (process.env.NODE_ENV === "test" &&
          !isDashboardRequestContext(auth) &&
          hasClerkManagedBillingCapability(billingCapabilityHeader))
    });
  }
}

function readServiceAuth(auth: DashboardAuthParam, _userIdHeader: string | string[] | undefined) {
  return toDashboardServiceAuth(auth, _userIdHeader);
}
