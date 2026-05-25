import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import {
  type RawReviewRunArtifactAccess,
  REVIEW_RUN_STATUSES,
  type ReviewRunDetail,
  type ReviewRunListFilters,
  type ReviewRunListResponse,
  type ReviewRunRetryResponse
} from "@firmcode/shared";
import { ReviewRunRetryService } from "./review-run-retry.service";
import { DashboardAuthGuard } from "../auth/dashboard-auth.guard";
import {
  DASHBOARD_AUTH_STORE,
  roleHasDashboardCapability,
  type DashboardAuthStore,
  type DashboardMembership
} from "./dashboard-auth.store";
import { REVIEW_RUNS_STORE, type ReviewRunsStore } from "./review-runs.store";

@Controller("api/review-runs")
@UseGuards(DashboardAuthGuard)
export class ReviewRunsController {
  constructor(
    @Inject(REVIEW_RUNS_STORE) private readonly reviewRunsStore: ReviewRunsStore,
    @Inject(DASHBOARD_AUTH_STORE) private readonly dashboardAuthStore: DashboardAuthStore,
    private readonly retryService?: ReviewRunRetryService
  ) {}

  @Get()
  async listReviewRuns(@Query() query: Record<string, string | string[] | undefined>): Promise<ReviewRunListResponse> {
    return this.reviewRunsStore.listReviewRuns(parseReviewRunListFilters(query));
  }

  @Get(":id")
  async getReviewRunDetail(
    @Param("id") id: string,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader?: string | string[],
    @Headers("x-firmcode-user-id") userIdHeader?: string | string[]
  ): Promise<ReviewRunDetail> {
    assertUuid("review run ID", id);
    const membership = await this.requireMembership(workspaceIdHeader, userIdHeader);
    const detail = await this.reviewRunsStore.getReviewRunDetail(id, {
      workspaceId: membership.workspaceId,
      canRetryReviewRun: roleHasDashboardCapability(membership.role, "retry_review_run"),
      canAccessRawArtifacts: roleHasDashboardCapability(membership.role, "access_raw_artifacts")
    });

    if (detail === null) {
      throw new NotFoundException("Review run not found");
    }

    return detail;
  }

  @Get(":id/artifacts/:artifactId/raw")
  async getRawArtifactAccess(
    @Param("id") id: string,
    @Param("artifactId") artifactId: string,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader?: string | string[],
    @Headers("x-firmcode-user-id") userIdHeader?: string | string[]
  ): Promise<RawReviewRunArtifactAccess> {
    assertUuid("review run ID", id);
    assertUuid("artifact ID", artifactId);
    const membership = await this.requireMembership(workspaceIdHeader, userIdHeader);

    if (!roleHasDashboardCapability(membership.role, "access_raw_artifacts")) {
      throw new ForbiddenException("Workspace role cannot access raw analysis artifacts");
    }

    const artifact = await this.reviewRunsStore.getRawArtifactAccess({
      reviewRunId: id,
      artifactId,
      workspaceId: membership.workspaceId
    });

    if (artifact === null) {
      throw new NotFoundException("Analysis artifact not found");
    }

    return artifact;
  }

  @Post(":id/retry")
  async retryReviewRun(
    @Param("id") id: string,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<ReviewRunRetryResponse> {
    if (this.retryService === undefined) {
      throw new NotFoundException("Review run not found");
    }

    return this.retryService.retryReviewRun({
      reviewRunId: id,
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null
    });
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
      throw new NotFoundException("Review run not found");
    }

    return membership;
  }
}

function parseReviewRunListFilters(query: Record<string, string | string[] | undefined>): ReviewRunListFilters {
  const status = readSingleValue(query.status);
  const repositoryId = readSingleValue(query.repositoryId);
  const repository = readSingleValue(query.repository);
  const triggerEvent = readSingleValue(query.triggerEvent);
  const risk = readSingleValue(query.risk);
  const dateFrom = readSingleValue(query.dateFrom);
  const dateTo = readSingleValue(query.dateTo);

  if (status !== undefined && !REVIEW_RUN_STATUSES.includes(status as (typeof REVIEW_RUN_STATUSES)[number])) {
    throw new BadRequestException("status must be a supported review run status");
  }

  if (risk !== undefined && risk !== "low" && risk !== "medium" && risk !== "high") {
    throw new BadRequestException("risk must be low, medium, or high");
  }

  validateIsoDateFilter("dateFrom", dateFrom);
  validateIsoDateFilter("dateTo", dateTo);

  return {
    status: status as ReviewRunListFilters["status"],
    repositoryId,
    repository,
    triggerEvent,
    risk: risk as ReviewRunListFilters["risk"],
    dateFrom,
    dateTo
  };
}

function readSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === "" ? undefined : value;
}

function validateIsoDateFilter(name: string, value: string | undefined): void {
  if (value !== undefined && Number.isNaN(Date.parse(value))) {
    throw new BadRequestException(`${name} must be a valid date`);
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(label: string, value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${label} must be a UUID`);
  }
}
