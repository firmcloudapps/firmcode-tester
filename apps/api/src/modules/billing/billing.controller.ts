import { Controller, Get, Headers } from "@nestjs/common";
import type { WorkspaceBillingResponse } from "@firmcode/shared";
import {
  hasClerkManagedBillingCapability
} from "../review-runs/dashboard-auth.store";
import { BillingService } from "./billing.service";

@Controller("api/billing")
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  async getWorkspaceBilling(
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-clerk-billing-capability") billingCapabilityHeader: string | string[] | undefined
  ): Promise<WorkspaceBillingResponse> {
    return this.billingService.getWorkspaceBilling({
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null,
      hasClerkBillingCapability: hasClerkManagedBillingCapability(billingCapabilityHeader)
    });
  }
}

function readSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === "" ? undefined : value;
}
