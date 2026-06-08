import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  DashboardAuth,
  type DashboardAuthParam
} from "../auth/dashboard-auth.context";
import { DashboardAuthGuard } from "../auth/dashboard-auth.guard";
import { PlatformOverviewService } from "./platform-overview.service";

@Controller("api/platform")
@UseGuards(DashboardAuthGuard)
export class PlatformOverviewController {
  constructor(private readonly service: PlatformOverviewService) { }

  @Get("overview")
  async getOverview(@DashboardAuth() auth: DashboardAuthParam) {
    return this.service.getOverview(auth);
  }
}
