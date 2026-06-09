import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Query,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import {
  CODEBASE_SCAN_FINDING_SOURCES,
  CODEBASE_SCAN_FINDING_STATUSES,
  CODEBASE_SCAN_STATUSES,
  CODEBASE_SCAN_TRIGGERS,
  REVIEW_FINDING_CATEGORIES,
  REVIEW_FINDING_SEVERITIES,
  type CodebaseScanFindingListFilters,
  type CodebaseScanFindingListResponse,
  type CodebaseScanRunDetailResponse,
  type CodebaseScanRunListFilters,
  type CodebaseScanRunListResponse,
  type UpdateCodebaseScanFindingStatusRequest
} from "@firmcode/shared";
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
import { CODEBASE_SCAN_STORE, type CodebaseScanStore } from "./codebase-scan.store";

@Controller()
@UseGuards(DashboardAuthGuard)
export class CodebaseScansController {
  constructor(
    @Inject(CODEBASE_SCAN_STORE) private readonly scanStore: CodebaseScanStore,
    @Inject(DASHBOARD_AUTH_STORE) private readonly dashboardAuthStore: DashboardAuthStore
  ) { }

  @Get("api/repositories/:id/codebase-scans")
  async listRepositoryScans(
    @Param("id") id: string,
    @Query() query: Record<string, string | string[] | undefined>,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<CodebaseScanRunListResponse> {
    assertUuid("repository ID", id);
    const membership = await this.requireMembership(auth, userIdHeader, "Codebase scans not found");
    const response = await this.scanStore.listRepositoryScanRuns({
      repositoryId: id,
      workspaceId: membership.workspaceId,
      accessScope: resolveRepositoryAccessScopeFromMembership(membership),
      filters: parseScanRunListFilters(query)
    });

    if (response === null) {
      throw new NotFoundException("Codebase scans not found");
    }

    return response;
  }

  @Get("api/codebase-scans/:id")
  async getScanDetail(
    @Param("id") id: string,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<CodebaseScanRunDetailResponse> {
    assertUuid("codebase scan ID", id);
    const membership = await this.requireMembership(auth, userIdHeader, "Codebase scan not found");
    const detail = await this.scanStore.getScanRunDetail({
      scanRunId: id,
      workspaceId: membership.workspaceId,
      accessScope: resolveRepositoryAccessScopeFromMembership(membership),
      canManageCodebaseFindings: hasMembershipCapability(membership, "manage_codebase_scan_findings")
    });

    if (detail === null) {
      throw new NotFoundException("Codebase scan not found");
    }

    return detail;
  }

  @Get("api/codebase-findings")
  async listCodebaseFindings(
    @Query() query: Record<string, string | string[] | undefined>,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<CodebaseScanFindingListResponse> {
    const membership = await this.requireMembership(auth, userIdHeader, "Codebase findings not found");
    const filters = parseCodebaseFindingListFilters(query);

    return this.scanStore.listWorkspaceFindings({
      workspaceId: membership.workspaceId,
      accessScope: resolveRepositoryAccessScopeFromMembership(membership),
      filters,
      canManageCodebaseFindings: hasMembershipCapability(membership, "manage_codebase_scan_findings")
    });
  }

  @Patch("api/codebase-findings/:id")
  async updateCodebaseFindingStatus(
    @Param("id") id: string,
    @Body() body: unknown,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ) {
    assertUuid("codebase finding ID", id);
    const membership = await this.requireMembership(auth, userIdHeader, "Codebase finding not found");

    if (!hasMembershipCapability(membership, "manage_codebase_scan_findings")) {
      throw new ForbiddenException("Workspace role cannot update codebase scan findings");
    }

    const finding = await this.scanStore.updateFindingStatus({
      findingId: id,
      workspaceId: membership.workspaceId,
      accessScope: resolveRepositoryAccessScopeFromMembership(membership),
      actorClerkUserId: membership.clerkUserId,
      update: parseUpdateCodebaseFindingStatusRequest(body)
    });

    if (finding === null) {
      throw new NotFoundException("Codebase finding not found");
    }

    return finding;
  }

  private async requireMembership(
    auth: DashboardAuthParam,
    userIdHeader: string | string[] | undefined,
    notFoundMessage: string
  ): Promise<DashboardMembership> {
    const membership = await resolveDashboardMembership(auth, userIdHeader, this.dashboardAuthStore, notFoundMessage);
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
      userId: membership.userId,
      orgId: null,
      provider: "insforge",
      workspaceId: membership.workspaceId,
      sessionId: null,
      role: membership.role,
      capabilities: [],
      billingCapabilities: []
    },
    capability
  );
}

function parseScanRunListFilters(query: Record<string, string | string[] | undefined>): CodebaseScanRunListFilters {
  const status = readSingleValue(query.status);
  const trigger = readSingleValue(query.trigger);
  const dateFrom = readSingleValue(query.dateFrom);
  const dateTo = readSingleValue(query.dateTo);

  validateEnumFilter("status", status, CODEBASE_SCAN_STATUSES);
  validateEnumFilter("trigger", trigger, CODEBASE_SCAN_TRIGGERS);
  validateIsoDateFilter("dateFrom", dateFrom);
  validateIsoDateFilter("dateTo", dateTo);

  return {
    status: status as CodebaseScanRunListFilters["status"],
    trigger: trigger as CodebaseScanRunListFilters["trigger"],
    dateFrom,
    dateTo
  };
}

function parseCodebaseFindingListFilters(query: Record<string, string | string[] | undefined>): CodebaseScanFindingListFilters {
  const repositoryId = readSingleValue(query.repositoryId);
  const repository = readSingleValue(query.repository);
  const severity = readSingleValue(query.severity);
  const source = readSingleValue(query.source);
  const category = readSingleValue(query.category);
  const status = readSingleValue(query.status);
  const dateFrom = readSingleValue(query.dateFrom);
  const dateTo = readSingleValue(query.dateTo);

  validateEnumFilter("severity", severity, REVIEW_FINDING_SEVERITIES);
  validateEnumFilter("source", source, CODEBASE_SCAN_FINDING_SOURCES);
  validateEnumFilter("category", category, REVIEW_FINDING_CATEGORIES);
  validateEnumFilter("status", status, CODEBASE_SCAN_FINDING_STATUSES);
  validateIsoDateFilter("dateFrom", dateFrom);
  validateIsoDateFilter("dateTo", dateTo);

  return {
    repositoryId,
    repository,
    severity: severity as CodebaseScanFindingListFilters["severity"],
    source: source as CodebaseScanFindingListFilters["source"],
    category: category as CodebaseScanFindingListFilters["category"],
    status: status as CodebaseScanFindingListFilters["status"],
    dateFrom,
    dateTo
  };
}

function parseUpdateCodebaseFindingStatusRequest(body: unknown): UpdateCodebaseScanFindingStatusRequest {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestException("Codebase finding status payload must be an object");
  }

  const payload = body as Record<string, unknown>;

  if (typeof payload.status !== "string" || !CODEBASE_SCAN_FINDING_STATUSES.includes(payload.status as never)) {
    throw new BadRequestException("status must be open, resolved, suppressed, or false_positive");
  }

  if (payload.reason !== undefined && payload.reason !== null) {
    if (typeof payload.reason !== "string" || payload.reason.length > 1000) {
      throw new BadRequestException("reason must be a string with at most 1000 characters");
    }
  }

  return {
    status: payload.status as UpdateCodebaseScanFindingStatusRequest["status"],
    reason: payload.reason === undefined ? null : (payload.reason as string | null)
  };
}

function readSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === "" ? undefined : value;
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(label: string, value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${label} must be a UUID`);
  }
}
