import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import {
  WORKER_REVIEW_JOB_INPUT_SCHEMA_VERSION,
  type ReviewRunRetryResponse,
  type ReviewRunStatus
} from "@firmcode/shared";
import { REVIEW_QUEUE, type ReviewQueueProducer } from "../queues/review-queue";
import {
  DASHBOARD_AUTH_STORE,
  roleHasDashboardCapability,
  type DashboardAuthStore
} from "./dashboard-auth.store";
import { resolveRepositoryAccessScope } from "../auth/repository-access-scope";
import {
  REVIEW_RUNS_STORE,
  type ReviewRunRetryCreation,
  type ReviewRunsStore
} from "./review-runs.store";

export interface ReviewRunRetryRequest {
  readonly reviewRunId: string;
  readonly workspaceId: string | null;
  readonly userId: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ReviewRunRetryService {
  constructor(
    @Inject(REVIEW_RUNS_STORE) private readonly reviewRunsStore: ReviewRunsStore,
    @Inject(DASHBOARD_AUTH_STORE) private readonly dashboardAuthStore: DashboardAuthStore,
    @Inject(REVIEW_QUEUE) private readonly reviewQueue: ReviewQueueProducer
  ) { }

  async retryReviewRun(input: ReviewRunRetryRequest): Promise<ReviewRunRetryResponse> {
    assertUuid("review run ID", input.reviewRunId);
    assertAuthenticated(input);

    assertUuid("workspace ID", input.workspaceId);

    const membership = await this.dashboardAuthStore.findActiveMembership({
      workspaceId: input.workspaceId,
      userId: input.userId
    });

    if (membership === null) {
      throw new NotFoundException("Review run not found");
    }

    if (!roleHasDashboardCapability(membership.role, "retry_review_run")) {
      throw new ForbiddenException("Workspace role cannot retry review runs");
    }

    const retry = await this.reviewRunsStore.createRetryReviewRun({
      reviewRunId: input.reviewRunId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      accessScope: resolveRepositoryAccessScope({
        role: membership.role,
        userId: membership.userId
      })
    });

    if (retry.kind === "not_found") {
      throw new NotFoundException("Review run not found");
    }

    if (retry.kind === "not_retryable") {
      throw new ConflictException({
        originalRunId: input.reviewRunId,
        retryRunId: null,
        retryJobId: null,
        status: retry.status,
        reason: retry.reason,
        message: retry.message
      } satisfies ReviewRunRetryResponse);
    }

    if (!retry.created) {
      return toRetryResponse(input.reviewRunId, retry, "duplicate_retry", "A retry has already been queued for this review run.");
    }

    const job = await this.reviewQueue.enqueuePullRequestReview({
      schemaVersion: WORKER_REVIEW_JOB_INPUT_SCHEMA_VERSION,
      deliveryId: retry.retryDeliveryId,
      reviewRunId: retry.retryRunId,
      repositoryId: retry.repositoryId,
      pullRequestId: retry.pullRequestId,
      pullRequestNumber: retry.pullRequestNumber,
      headSha: retry.headSha,
      triggerEvent: retry.triggerEvent
    });

    await this.reviewRunsStore.markRetryJobQueued({
      originalReviewRunId: input.reviewRunId,
      retryJobId: job.id
    });

    return {
      originalRunId: input.reviewRunId,
      retryRunId: retry.retryRunId,
      retryJobId: job.id,
      status: retry.status,
      reason: "retry_queued",
      message: "Review retry queued."
    };
  }
}

function assertAuthenticated(input: ReviewRunRetryRequest): asserts input is ReviewRunRetryRequest & {
  workspaceId: string;
  userId: string;
} {
  if (input.workspaceId === null || input.userId === null) {
    throw new UnauthorizedException("Dashboard authentication is required");
  }
}

function assertUuid(label: string, value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${label} must be a UUID`);
  }
}

function toRetryResponse(
  originalRunId: string,
  retry: ReviewRunRetryCreation,
  reason: "duplicate_retry",
  message: string
): ReviewRunRetryResponse {
  return {
    originalRunId,
    retryRunId: retry.retryRunId,
    retryJobId: retry.retryJobId,
    status: retry.status,
    reason,
    message
  };
}
