import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  UseGuards
} from "@nestjs/common";
import { REVIEW_RUN_STATUSES, type CiFailureDetailResponse, type CiFailureListFilters, type CiFailureListResponse } from "@firmcode/shared";
import {
  DashboardAuth,
  hasDashboardCapability,
  resolveDashboardMembership,
  resolveRepositoryAccessScopeFromMembership,
  type DashboardAuthParam
} from "../auth/dashboard-auth.context";
import { DashboardAuthGuard } from "../auth/dashboard-auth.guard";
import {
  DASHBOARD_AUTH_STORE,
  type DashboardAuthStore,
  type DashboardMembership
} from "../review-runs/dashboard-auth.store";
import { CI_FAILURES_STORE, type CiFailuresStore } from "./ci-failures.store";

@Controller("api/ci-failures")
@UseGuards(DashboardAuthGuard)
export class CiFailuresController {
  constructor(
    @Inject(CI_FAILURES_STORE) private readonly ciFailuresStore: CiFailuresStore,
    @Inject(DASHBOARD_AUTH_STORE) private readonly dashboardAuthStore: DashboardAuthStore
  ) { }

  @Get()
  async listCiFailures(
    @Query() query: Record<string, string | string[] | undefined>,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<CiFailureListResponse> {
    const membership = await this.requireMembership(auth, userIdHeader);

    return this.ciFailuresStore.listCiFailures({
      workspaceId: membership.workspaceId,
      canAccessRawArtifacts: hasMembershipCapability(membership, "access_raw_artifacts"),
      filters: parseCiFailureListFilters(query),
      accessScope: resolveRepositoryAccessScopeFromMembership(membership)
    });
  }

  @Get(":id")
  async getCiFailureDetail(
    @Param("id") id: string,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<CiFailureDetailResponse> {
    assertCiFailureId(id);
    const membership = await this.requireMembership(auth, userIdHeader);
    const detail = await this.ciFailuresStore.getCiFailureDetail({
      workspaceId: membership.workspaceId,
      ciFailureId: id,
      canAccessRawArtifacts: hasMembershipCapability(membership, "access_raw_artifacts"),
      accessScope: resolveRepositoryAccessScopeFromMembership(membership)
    });

    if (detail === null) {
      throw new NotFoundException("CI failure not found");
    }

    return detail;
  }

  private async requireMembership(
    auth: DashboardAuthParam,
    userIdHeader: string | string[] | undefined
  ): Promise<DashboardMembership> {
    const membership = await resolveDashboardMembership(auth, userIdHeader, this.dashboardAuthStore, "CI failure not found");
    assertUuid("workspace ID", membership.workspaceId);
    return membership;
  }
}

function hasMembershipCapability(
  membership: DashboardMembership,
  capability: Parameters<typeof hasDashboardCapability>[1]
): boolean {
  return hasDashboardCapability(
    {
      workspaceId: membership.workspaceId,
      clerkUserId: membership.clerkUserId,
      clerkOrgId: null,
      sessionId: null,
      role: membership.role,
      capabilities: [],
      clerkCapabilities: []
    },
    capability
  );
}

function parseCiFailureListFilters(query: Record<string, string | string[] | undefined>): CiFailureListFilters {
  const repositoryId = readSingleValue(query.repositoryId);
  const repository = readSingleValue(query.repository);
  const status = readSingleValue(query.status);
  const flaky = readSingleValue(query.flaky);
  const dateFrom = readSingleValue(query.dateFrom);
  const dateTo = readSingleValue(query.dateTo);
  const limit = readSingleValue(query.limit);

  if (repositoryId !== undefined) {
    assertUuid("repository ID", repositoryId);
  }

  if (status !== undefined && !REVIEW_RUN_STATUSES.includes(status as (typeof REVIEW_RUN_STATUSES)[number])) {
    throw new BadRequestException("status must be a supported review run status");
  }

  validateIsoDateFilter("dateFrom", dateFrom);
  validateIsoDateFilter("dateTo", dateTo);

  if (dateFrom !== undefined && dateTo !== undefined && new Date(dateFrom).getTime() > new Date(dateTo).getTime()) {
    throw new BadRequestException("dateFrom must be before or equal to dateTo");
  }

  return {
    repositoryId,
    repository,
    status: status as CiFailureListFilters["status"],
    flaky: parseBooleanFilter(flaky),
    dateFrom,
    dateTo,
    limit: parseLimit(limit)
  };
}

function parseBooleanFilter(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new BadRequestException("flaky must be true or false");
}

function validateIsoDateFilter(name: string, value: string | undefined): void {
  if (value !== undefined && Number.isNaN(Date.parse(value))) {
    throw new BadRequestException(`${name} must be a valid date`);
  }
}

function parseLimit(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new BadRequestException("limit must be an integer between 1 and 100");
  }

  return parsed;
}

function readSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === "" ? undefined : value;
}

function assertCiFailureId(value: string): void {
  const [artifactId, groupId] = value.split(":");

  if (artifactId === undefined || groupId === undefined || groupId.length === 0) {
    throw new BadRequestException("CI failure ID must include an artifact and group");
  }

  assertUuid("CI failure artifact ID", artifactId);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(label: string, value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${label} must be a UUID`);
  }
}
