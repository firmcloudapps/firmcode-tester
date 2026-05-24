import { Body, Controller, Get, Headers, Patch, Query } from "@nestjs/common";
import type { RulesPolicyResponse } from "@firmcode/shared";
import { RulesService } from "./rules.service";

@Controller("api/rules")
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  async getRules(
    @Query("repositoryId") repositoryId: string | string[] | undefined,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<RulesPolicyResponse> {
    return this.rulesService.getRules({
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null,
      repositoryId: readSingleValue(repositoryId)
    });
  }

  @Patch()
  async updateRules(
    @Body() body: unknown,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<RulesPolicyResponse> {
    return this.rulesService.updateRules({
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null,
      body
    });
  }
}

function readSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === "" ? undefined : value;
}
