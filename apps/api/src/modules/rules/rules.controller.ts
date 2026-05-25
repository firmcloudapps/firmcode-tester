import { Body, Controller, Get, Patch, Query, UseGuards } from "@nestjs/common";
import type { RulesPolicyResponse } from "@firmcode/shared";
import {
  DashboardAuth,
  toDashboardServiceAuth,
  type DashboardAuthParam,
  type DashboardRequestContext
} from "../auth/dashboard-auth.context";
import { DashboardAuthGuard } from "../auth/dashboard-auth.guard";
import { RulesService } from "./rules.service";

@Controller("api/rules")
@UseGuards(DashboardAuthGuard)
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  async getRules(
    @Query("repositoryId") repositoryId: string | string[] | undefined,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<RulesPolicyResponse> {
    return this.rulesService.getRules({
      ...readServiceAuth(auth, userIdHeader),
      repositoryId: readSingleValue(repositoryId)
    });
  }

  @Patch()
  async updateRules(
    @Body() body: unknown,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<RulesPolicyResponse> {
    return this.rulesService.updateRules({
      ...readServiceAuth(auth, userIdHeader),
      body
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
