import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import {
  REVIEW_RUN_STATUSES,
  type PullRequestDetailResponse,
  type PullRequestListFilters,
  type PullRequestListResponse
} from "@firmcode/shared";
import {
  DASHBOARD_AUTH_STORE,
  type DashboardAuthStore,
  type DashboardMembership
} from "../review-runs/dashboard-auth.store";
import { PULL_REQUESTS_STORE, type PullRequestsStore } from "./pull-requests.store";

@Controller("api/pull-requests")
export class PullRequestsController {
  constructor(
    @Inject(PULL_REQUESTS_STORE) private readonly pullRequestsStore: PullRequestsStore,
    @Inject(DASHBOARD_AUTH_STORE) private readonly dashboardAuthStore: DashboardAuthStore
  ) {}

  @Get()
  async listPullRequests(
    @Query() query: Record<string, string | string[] | undefined>,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader?: string | string[],
    @Headers("x-firmcode-user-id") userIdHeader?: string | string[]
  ): Promise<PullRequestListResponse> {
    const membership = await this.requireMembership(workspaceIdHeader, userIdHeader);

    return this.pullRequestsStore.listPullRequests({
      workspaceId: membership.workspaceId,
      filters: parsePullRequestListFilters(query)
    });
  }

  @Get(":id")
  async getPullRequestDetail(
    @Param("id") id: string,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader?: string | string[],
    @Headers("x-firmcode-user-id") userIdHeader?: string | string[]
  ): Promise<PullRequestDetailResponse> {
    assertUuid("pull request ID", id);
    const membership = await this.requireMembership(workspaceIdHeader, userIdHeader);
    const detail = await this.pullRequestsStore.getPullRequestDetail({
      workspaceId: membership.workspaceId,
      pullRequestId: id
    });

    if (detail === null) {
      throw new NotFoundException("Pull request not found");
    }

    return detail;
  }

  private async requireMembership(
    workspaceIdHeader: string | string[] | undefined,
    userIdHeader: string | string[] | undefined
  ): Promise<DashboardMembership> {
    const workspaceId = readSingleValue(workspaceIdHeader) ?? null;
    const clerkUserId = readSingleValue(userIdHeader) ?? null;

    if (workspaceId === null || clerkUserId === null) {
      throw new UnauthorizedException("Dashboard authentication is required");
    }

    assertUuid("workspace ID", workspaceId);

    const membership = await this.dashboardAuthStore.findActiveMembership({ workspaceId, clerkUserId });

    if (membership === null) {
      throw new NotFoundException("Pull request not found");
    }

    return membership;
  }
}

function parsePullRequestListFilters(query: Record<string, string | string[] | undefined>): PullRequestListFilters {
  const repositoryId = readSingleValue(query.repositoryId);
  const repository = readSingleValue(query.repository);
  const status = readSingleValue(query.status);
  const riskLevel = readSingleValue(query.riskLevel);
  const reviewStatus = readSingleValue(query.reviewStatus);
  const author = readSingleValue(query.author);
  const dateFrom = readSingleValue(query.dateFrom);
  const dateTo = readSingleValue(query.dateTo);
  const limit = readSingleValue(query.limit);

  if (repositoryId !== undefined) {
    assertUuid("repository ID", repositoryId);
  }

  validateEnumFilter("status", status, PULL_REQUEST_DASHBOARD_STATUSES);
  validateEnumFilter("reviewStatus", reviewStatus, REVIEW_RUN_STATUSES);
  validateEnumFilter("riskLevel", riskLevel, ["low", "medium", "high", "unknown"]);
  validateIsoDateFilter("dateFrom", dateFrom);
  validateIsoDateFilter("dateTo", dateTo);

  if (dateFrom !== undefined && dateTo !== undefined && new Date(dateFrom).getTime() > new Date(dateTo).getTime()) {
    throw new BadRequestException("dateFrom must be before or equal to dateTo");
  }

  return {
    repositoryId,
    repository,
    status: status as PullRequestListFilters["status"],
    riskLevel: riskLevel as PullRequestListFilters["riskLevel"],
    reviewStatus: reviewStatus as PullRequestListFilters["reviewStatus"],
    author,
    dateFrom,
    dateTo,
    limit: parseLimit(limit)
  };
}

function validateEnumFilter(name: string, value: string | undefined, allowedValues: readonly string[]): void {
  if (value !== undefined && !allowedValues.includes(value)) {
    throw new BadRequestException(`${name} must be one of: ${allowedValues.join(", ")}`);
  }
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PULL_REQUEST_DASHBOARD_STATUSES = ["open", "closed", "merged", "draft"] as const;

function assertUuid(label: string, value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${label} must be a UUID`);
  }
}
