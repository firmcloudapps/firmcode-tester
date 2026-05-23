import { BadRequestException, Controller, Get, Headers, Inject, NotFoundException, Param, Post, Query } from "@nestjs/common";
import {
  REVIEW_RUN_STATUSES,
  type ReviewRunDetail,
  type ReviewRunListFilters,
  type ReviewRunListResponse,
  type ReviewRunRetryResponse
} from "@firmcode/shared";
import { ReviewRunRetryService } from "./review-run-retry.service";
import { REVIEW_RUNS_STORE, type ReviewRunsStore } from "./review-runs.store";

@Controller("api/review-runs")
export class ReviewRunsController {
  constructor(
    @Inject(REVIEW_RUNS_STORE) private readonly reviewRunsStore: ReviewRunsStore,
    private readonly retryService?: ReviewRunRetryService
  ) {}

  @Get()
  async listReviewRuns(@Query() query: Record<string, string | string[] | undefined>): Promise<ReviewRunListResponse> {
    return this.reviewRunsStore.listReviewRuns(parseReviewRunListFilters(query));
  }

  @Get(":id")
  async getReviewRunDetail(@Param("id") id: string): Promise<ReviewRunDetail> {
    const detail = await this.reviewRunsStore.getReviewRunDetail(id);

    if (detail === null) {
      throw new NotFoundException("Review run not found");
    }

    return detail;
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
