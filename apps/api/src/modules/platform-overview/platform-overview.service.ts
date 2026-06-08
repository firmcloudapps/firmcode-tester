import { Inject, Injectable } from "@nestjs/common";
import type { PlatformAdminOverviewResponse } from "@firmcode/shared";
import {
  requireDashboardCapability,
  requireDashboardRequestContext,
  type DashboardAuthParam
} from "../auth/dashboard-auth.context";
import {
  PLATFORM_OVERVIEW_STORE,
  type PlatformOverviewStore
} from "./platform-overview.store";

@Injectable()
export class PlatformOverviewService {
  constructor(
    @Inject(PLATFORM_OVERVIEW_STORE) private readonly store: PlatformOverviewStore
  ) { }

  async getOverview(auth: DashboardAuthParam): Promise<PlatformAdminOverviewResponse> {
    const context = requireDashboardRequestContext(auth);
    requireDashboardCapability(context, "manage_sensitive_settings", "Platform admin access is required");

    return {
      metrics: await this.store.getMetrics(),
      generatedAt: new Date().toISOString()
    };
  }
}
