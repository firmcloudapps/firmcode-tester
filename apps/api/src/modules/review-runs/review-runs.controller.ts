import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
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
import {
  DashboardAuth,
  hasDashboardCapability,
  resolveDashboardMembership,
  resolveRepositoryAccessScopeFromAuth,
  resolveRepositoryAccessScopeFromMembership,
  toDashboardServiceAuth,
  type DashboardAuthParam
} from "../auth/dashboard-auth.context";
import { DashboardAuthGuard } from "../auth/dashboard-auth.guard";
import {
  DASHBOARD_AUTH_STORE,
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
  ) { }

  @Get()
  async listReviewRuns(
    @Query() query: Record<string, string | string[] | undefined>,
    @DashboardAuth() auth: DashboardAuthParam
  ): Promise<ReviewRunListResponse> {
    const serviceAuth = toDashboardServiceAuth(auth);
    if (serviceAuth.workspaceId === null) {
      throw new UnauthorizedException("Dashboard authentication is required");
    }

    return this.reviewRunsStore.listReviewRuns({
      ...parseReviewRunListFilters(query),
      workspaceId: serviceAuth.workspaceId,
      accessScope: resolveRepositoryAccessScopeFromAuth(auth)
    });
  }

  @Get(":id")
  async getReviewRunDetail(
    @Param("id") id: string,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<ReviewRunDetail> {
    assertUuid("review run ID", id);
    const membership = await this.requireMembership(auth, userIdHeader);
    const detail = await this.reviewRunsStore.getReviewRunDetail(id, {
      workspaceId: membership.workspaceId,
      canRetryReviewRun: hasMembershipCapability(membership, "retry_review_run"),
      canAccessRawArtifacts: hasMembershipCapability(membership, "access_raw_artifacts"),
      accessScope: resolveRepositoryAccessScopeFromMembership(membership)
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
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<RawReviewRunArtifactAccess> {
    assertUuid("review run ID", id);
    assertUuid("artifact ID", artifactId);
    const membership = await this.requireMembership(auth, userIdHeader);

    if (!hasMembershipCapability(membership, "access_raw_artifacts")) {
      throw new ForbiddenException("Workspace role cannot access raw analysis artifacts");
    }

    const artifact = await this.reviewRunsStore.getRawArtifactAccess({
      reviewRunId: id,
      artifactId,
      workspaceId: membership.workspaceId,
      accessScope: resolveRepositoryAccessScopeFromMembership(membership)
    });

    if (artifact === null) {
      throw new NotFoundException("Analysis artifact not found");
    }

    return artifact;
  }

  @Post(":id/retry")
  async retryReviewRun(
    @Param("id") id: string,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<ReviewRunRetryResponse> {
    if (this.retryService === undefined) {
      throw new NotFoundException("Review run not found");
    }

    return this.retryService.retryReviewRun({
      reviewRunId: id,
      ...readServiceAuth(auth, userIdHeader)
    });
  }

  private async requireMembership(
    auth: DashboardAuthParam,
    userIdHeader: string | string[] | undefined
  ): Promise<DashboardMembership> {
    const membership = await resolveDashboardMembership(auth, userIdHeader, this.dashboardAuthStore, "Review run not found");
    assertUuid("workspace ID", membership.workspaceId);
    return membership;
  }
}

function readServiceAuth(auth: DashboardAuthParam, _userIdHeader: string | string[] | undefined) {
  return toDashboardServiceAuth(auth, _userIdHeader);
}

function hasMembershipCapability(
  membership: DashboardMembership,
  capability: Parameters<typeof hasDashboardCapability>[1]
): boolean {
  return hasDashboardCapability(
    {
      workspaceId: membership.workspaceId,
      userId: membership.userId ?? membership.clerkUserId,
      orgId: null,
      clerkUserId: membership.clerkUserId,
      clerkOrgId: null,
      sessionId: null,
      role: membership.role,
      capabilities: [],
      billingCapabilities: [],
      clerkCapabilities: [],
      provider: "insforge"
    },
    capability
  );
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
