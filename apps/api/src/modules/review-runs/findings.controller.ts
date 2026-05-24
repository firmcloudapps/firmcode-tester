import { BadRequestException, Controller, Get, Headers, Inject, Query } from "@nestjs/common";
import {
  REVIEW_FINDING_CATEGORIES,
  REVIEW_FINDING_SEVERITIES,
  REVIEW_FINDING_SOURCES,
  REVIEW_FINDING_STATUSES,
  type FindingsListFilters,
  type FindingsListResponse
} from "@firmcode/shared";
import {
  authorizeDashboardRequest,
  readSingleHeader
} from "./dashboard-authorization";
import { DASHBOARD_AUTH_STORE, type DashboardAuthStore } from "./dashboard-auth.store";
import { FINDINGS_STORE, type FindingsStore } from "./findings.store";

@Controller("api/findings")
export class FindingsController {
  constructor(
    @Inject(FINDINGS_STORE) private readonly findingsStore: FindingsStore,
    @Inject(DASHBOARD_AUTH_STORE) private readonly dashboardAuthStore: DashboardAuthStore
  ) {}

  @Get()
  async listFindings(
    @Query() query: Record<string, string | string[] | undefined>,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader?: string | string[],
    @Headers("x-firmcode-user-id") userIdHeader?: string | string[]
  ): Promise<FindingsListResponse> {
    const membership = await authorizeDashboardRequest(this.dashboardAuthStore, {
      workspaceId: readSingleHeader(workspaceIdHeader),
      clerkUserId: readSingleHeader(userIdHeader)
    });

    return this.findingsStore.listFindings({
      workspaceId: membership.workspaceId,
      filters: parseFindingsListFilters(query)
    });
  }
}

function parseFindingsListFilters(query: Record<string, string | string[] | undefined>): FindingsListFilters {
  const severity = readSingleValue(query.severity);
  const source = readSingleValue(query.source);
  const category = readSingleValue(query.category);
  const repositoryId = readSingleValue(query.repositoryId);
  const repository = readSingleValue(query.repository);
  const status = readSingleValue(query.status);
  const postedInline = readSingleValue(query.postedInline);
  const dateFrom = readSingleValue(query.dateFrom);
  const dateTo = readSingleValue(query.dateTo);

  validateEnumFilter("severity", severity, REVIEW_FINDING_SEVERITIES);
  validateEnumFilter("source", source, REVIEW_FINDING_SOURCES);
  validateEnumFilter("category", category, REVIEW_FINDING_CATEGORIES);
  validateEnumFilter("status", status, REVIEW_FINDING_STATUSES);
  validateBooleanFilter("postedInline", postedInline);
  validateIsoDateFilter("dateFrom", dateFrom);
  validateIsoDateFilter("dateTo", dateTo);

  return {
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
