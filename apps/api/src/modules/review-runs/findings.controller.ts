import { BadRequestException, Controller, Get, Headers, Inject, NotFoundException, Query, UnauthorizedException, UseGuards } from "@nestjs/common";
import {
  FINDING_INBOX_SOURCES,
  REVIEW_FINDING_CATEGORIES,
  REVIEW_FINDING_SEVERITIES,
  REVIEW_FINDING_STATUSES,
  type FindingsListFilters,
  type FindingsListResponse
} from "@firmcode/shared";
import { DashboardAuthGuard } from "../auth/dashboard-auth.guard";
import {
  DASHBOARD_AUTH_STORE,
  roleHasDashboardCapability,
  type DashboardAuthStore
} from "./dashboard-auth.store";
import { FINDINGS_STORE, type FindingsStore } from "./findings.store";

@Controller("api/findings")
@UseGuards(DashboardAuthGuard)
export class FindingsController {
  constructor(
    @Inject(FINDINGS_STORE) private readonly findingsStore: FindingsStore,
    @Inject(DASHBOARD_AUTH_STORE) private readonly dashboardAuthStore: DashboardAuthStore
  ) {}

  @Get()
  async listFindings(
    @Query() query: Record<string, string | string[] | undefined>,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<FindingsListResponse> {
    const workspaceId = readSingleValue(workspaceIdHeader) ?? null;
    const clerkUserId = readSingleValue(userIdHeader) ?? null;

    if (workspaceId === null || clerkUserId === null) {
      throw new UnauthorizedException("Dashboard authentication is required");
    }

    assertUuid("workspace ID", workspaceId);
    const membership = await this.dashboardAuthStore.findActiveMembership({ workspaceId, clerkUserId });

    if (membership === null) {
      throw new NotFoundException("Findings not found");
    }

    return this.findingsStore.listFindings({
      workspaceId,
      filters: parseFindingsListFilters(query),
      canManageCodebaseFindings: roleHasDashboardCapability(membership.role, "manage_codebase_scan_findings")
    });
  }
}

function parseFindingsListFilters(query: Record<string, string | string[] | undefined>): FindingsListFilters {
  const findingType = readSingleValue(query.findingType);
  const severity = readSingleValue(query.severity);
  const source = readSingleValue(query.source);
  const category = readSingleValue(query.category);
  const repositoryId = readSingleValue(query.repositoryId);
  const repository = readSingleValue(query.repository);
  const status = readSingleValue(query.status);
  const postedInline = readSingleValue(query.postedInline);
  const dateFrom = readSingleValue(query.dateFrom);
  const dateTo = readSingleValue(query.dateTo);

  validateEnumFilter("findingType", findingType, ["pull_request", "codebase_scan"]);
  validateEnumFilter("severity", severity, REVIEW_FINDING_SEVERITIES);
  validateEnumFilter("source", source, FINDING_INBOX_SOURCES);
  validateEnumFilter("category", category, REVIEW_FINDING_CATEGORIES);
  validateEnumFilter("status", status, REVIEW_FINDING_STATUSES);
  validateBooleanFilter("postedInline", postedInline);
  validateIsoDateFilter("dateFrom", dateFrom);
  validateIsoDateFilter("dateTo", dateTo);

  return {
    findingType: findingType as FindingsListFilters["findingType"],
    severity: severity as FindingsListFilters["severity"],
    source: source as FindingsListFilters["source"],
    category: category as FindingsListFilters["category"],
    repositoryId,
    repository,
    status: status as FindingsListFilters["status"],
    postedInline: parseBoolean(postedInline),
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

function validateEnumFilter(name: string, value: string | undefined, allowedValues: readonly string[]): void {
  if (value !== undefined && !allowedValues.includes(value)) {
    throw new BadRequestException(`${name} must be one of: ${allowedValues.join(", ")}`);
  }
}

function validateBooleanFilter(name: string, value: string | undefined): void {
  if (value !== undefined && value !== "true" && value !== "false") {
    throw new BadRequestException(`${name} must be true or false`);
  }
}

function validateIsoDateFilter(name: string, value: string | undefined): void {
  if (value !== undefined && Number.isNaN(Date.parse(value))) {
    throw new BadRequestException(`${name} must be a valid date`);
  }
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(label: string, value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${label} must be a UUID`);
  }
}
