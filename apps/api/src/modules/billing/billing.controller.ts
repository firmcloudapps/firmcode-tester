import { Controller, Get, UseGuards } from "@nestjs/common";
import type { WorkspaceBillingResponse } from "@firmcode/shared";
import {
  DashboardAuth,
  toDashboardServiceAuth,
  type DashboardAuthParam,
  type DashboardRequestContext
} from "../auth/dashboard-auth.context";
import { DashboardAuthGuard } from "../auth/dashboard-auth.guard";
import {
  hasClerkManagedBillingCapability
} from "../review-runs/dashboard-auth.store";
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
        (typeof auth === "object" &&
          auth !== null &&
          !Array.isArray(auth) &&
          "capabilities" in auth &&
          (auth as DashboardRequestContext).capabilities.includes("manage_billing")) ||
        hasClerkManagedBillingCapability(billingCapabilityHeader)
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
