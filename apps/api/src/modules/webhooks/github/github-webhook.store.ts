import { randomUUID } from "crypto";
import type { ReviewRunStatus } from "@firmcode/shared";

type MaybePromise<T> = T | Promise<T>;

export type GitHubDeliveryStatus = "processing" | "processed" | "ignored" | "failed";

export interface GitHubDeliveryInput {
  deliveryId: string;
  eventName: string;
  action: string | null;
  installationId: number | null;
  repositoryId: number | null;
  pullRequestNumber: number | null;
  headSha: string | null;
}

export interface GitHubDeliveryRecord extends GitHubDeliveryInput {
  status: GitHubDeliveryStatus;
  receivedAt: Date;
  processedAt: Date | null;
  error: string | null;
}

export interface GitHubInstallationUpsert {
  installationId: number;
  accountLogin: string | null;
  accountType: string | null;
  permissionsJson: Record<string, unknown>;
}

export interface GitHubInstallationRecord extends GitHubInstallationUpsert {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RepositoryUpsert {
  installationId: string;
  githubRepositoryId: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  enabled: boolean;
}

export interface RepositoryRecord extends RepositoryUpsert {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PullRequestUpsert {
  repositoryId: string;
  githubPullRequestId: number;
  number: number;
  title: string;
  authorLogin: string;
  baseRef: string;
  headRef: string;
  baseSha: string;
  headSha: string;
  state: string;
  draft: boolean;
}

export interface PullRequestRecord extends PullRequestUpsert {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewRunInput {
  repositoryId: string;
  pullRequestId: string;
  deliveryId: string;
  triggerEvent: string;
  headSha: string;
}

export interface ReviewRunRecord extends ReviewRunInput {
  id: string;
  status: ReviewRunStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  metricsJson: Record<string, unknown>;
  createdAt: Date;
}

export interface SupersedeReviewRunsInput {
  pullRequestId: string;
  headSha: string;
  supersededByDeliveryId: string;
}

export interface ReviewRunStatusUpdate {
  reviewRunId: string;
  status: ReviewRunStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface ReviewRunPublishCheckInput {
  reviewRunId: string;
  currentHeadSha: string;
}

export type ReviewRunPublishBlockedReason =
  | "review_run_not_found"
  | "review_run_superseded"
  | "head_sha_changed";

export interface ReviewRunPublishCheck {
  publishable: boolean;
  reason: ReviewRunPublishBlockedReason | null;
  reviewRun: ReviewRunRecord | null;
  currentHeadSha: string;
}

export interface GitHubWebhookStore {
  createDelivery(input: GitHubDeliveryInput): MaybePromise<{ created: boolean; delivery: GitHubDeliveryRecord }>;
  markDeliveryProcessed(
    deliveryId: string,
    status: Exclude<GitHubDeliveryStatus, "processing">,
    error?: string
  ): MaybePromise<void>;
  upsertInstallation(input: GitHubInstallationUpsert): MaybePromise<GitHubInstallationRecord>;
  upsertRepository(input: RepositoryUpsert): MaybePromise<RepositoryRecord>;
  upsertPullRequest(input: PullRequestUpsert): MaybePromise<PullRequestRecord>;
  createReviewRun(input: ReviewRunInput): MaybePromise<ReviewRunRecord>;
  findReviewRun(reviewRunId: string): MaybePromise<ReviewRunRecord | null>;
  updateReviewRunStatus(input: ReviewRunStatusUpdate): MaybePromise<ReviewRunRecord | null>;
  supersedeQueuedOrRunningReviewRuns(input: SupersedeReviewRunsInput): MaybePromise<ReviewRunRecord[]>;
  verifyReviewRunHeadBeforePublishing(input: ReviewRunPublishCheckInput): MaybePromise<ReviewRunPublishCheck>;
}

export const GITHUB_WEBHOOK_STORE = Symbol("GITHUB_WEBHOOK_STORE");

const SUPERSEDABLE_REVIEW_RUN_STATUSES = new Set<ReviewRunStatus>(["queued", "running"]);
const FINISHED_REVIEW_RUN_STATUSES = new Set<ReviewRunStatus>(["succeeded", "failed", "superseded"]);

export class InMemoryGitHubWebhookStore implements GitHubWebhookStore {
  readonly deliveries = new Map<string, GitHubDeliveryRecord>();
  readonly installations = new Map<number, GitHubInstallationRecord>();
  readonly repositories = new Map<number, RepositoryRecord>();
  readonly pullRequests = new Map<string, PullRequestRecord>();
  readonly reviewRuns: ReviewRunRecord[] = [];

  createDelivery(input: GitHubDeliveryInput): { created: boolean; delivery: GitHubDeliveryRecord } {
    const existing = this.deliveries.get(input.deliveryId);

    if (existing !== undefined) {
      return { created: false, delivery: existing };
    }

    const delivery: GitHubDeliveryRecord = {
      ...input,
      status: "processing",
      receivedAt: new Date(),
      processedAt: null,
      error: null
    };
    this.deliveries.set(input.deliveryId, delivery);

    return { created: true, delivery };
  }

  markDeliveryProcessed(deliveryId: string, status: Exclude<GitHubDeliveryStatus, "processing">, error?: string): void {
    const delivery = this.deliveries.get(deliveryId);

    if (delivery === undefined) {
      return;
    }

    this.deliveries.set(deliveryId, {
      ...delivery,
      status,
      processedAt: new Date(),
      error: error ?? null
    });
  }

  upsertInstallation(input: GitHubInstallationUpsert): GitHubInstallationRecord {
    const existing = this.installations.get(input.installationId);
    const now = new Date();
    const installation: GitHubInstallationRecord = {
      id: existing?.id ?? randomUUID(),
      ...input,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.installations.set(input.installationId, installation);

    return installation;
  }

  upsertRepository(input: RepositoryUpsert): RepositoryRecord {
    const existing = this.repositories.get(input.githubRepositoryId);
    const now = new Date();
    const repository: RepositoryRecord = {
      id: existing?.id ?? randomUUID(),
      ...input,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.repositories.set(input.githubRepositoryId, repository);

    return repository;
  }

  upsertPullRequest(input: PullRequestUpsert): PullRequestRecord {
    const key = `${input.repositoryId}:${input.number}`;
    const existing = this.pullRequests.get(key);
    const now = new Date();
    const pullRequest: PullRequestRecord = {
      id: existing?.id ?? randomUUID(),
      ...input,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.pullRequests.set(key, pullRequest);

    return pullRequest;
  }

  createReviewRun(input: ReviewRunInput): ReviewRunRecord {
    const reviewRun: ReviewRunRecord = {
      id: randomUUID(),
      ...input,
      status: "queued",
      startedAt: null,
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
      metricsJson: {},
      createdAt: new Date()
    };
    this.reviewRuns.push(reviewRun);

    return reviewRun;
  }

  findReviewRun(reviewRunId: string): ReviewRunRecord | null {
    return this.reviewRuns.find((reviewRun) => reviewRun.id === reviewRunId) ?? null;
  }

  updateReviewRunStatus(input: ReviewRunStatusUpdate): ReviewRunRecord | null {
    const existing = this.findReviewRun(input.reviewRunId);

    if (existing === null) {
      return null;
    }

    return this.replaceReviewRun({
      ...existing,
      status: input.status,
      startedAt: input.status === "running" ? existing.startedAt ?? new Date() : existing.startedAt,
      finishedAt: FINISHED_REVIEW_RUN_STATUSES.has(input.status) ? existing.finishedAt ?? new Date() : existing.finishedAt,
      errorCode: input.errorCode === undefined ? existing.errorCode : input.errorCode,
      errorMessage: input.errorMessage === undefined ? existing.errorMessage : input.errorMessage
    });
  }

  supersedeQueuedOrRunningReviewRuns(input: SupersedeReviewRunsInput): ReviewRunRecord[] {
    const supersededAt = new Date();
    const supersededRuns: ReviewRunRecord[] = [];

    for (const reviewRun of this.reviewRuns) {
      if (
        reviewRun.pullRequestId === input.pullRequestId &&
        reviewRun.headSha !== input.headSha &&
        SUPERSEDABLE_REVIEW_RUN_STATUSES.has(reviewRun.status)
      ) {
        const supersededRun = this.replaceReviewRun({
          ...reviewRun,
          status: "superseded",
          finishedAt: reviewRun.finishedAt ?? supersededAt,
          errorCode: "superseded_by_new_head",
          errorMessage: `Superseded by delivery ${input.supersededByDeliveryId} for head ${input.headSha}`
        });

        supersededRuns.push(supersededRun);
      }
    }

    return supersededRuns;
  }

  verifyReviewRunHeadBeforePublishing(input: ReviewRunPublishCheckInput): ReviewRunPublishCheck {
    const reviewRun = this.findReviewRun(input.reviewRunId);

    if (reviewRun === null) {
      return {
        publishable: false,
        reason: "review_run_not_found",
        reviewRun: null,
        currentHeadSha: input.currentHeadSha
      };
    }

    if (reviewRun.status === "superseded") {
      return {
        publishable: false,
        reason: "review_run_superseded",
        reviewRun,
        currentHeadSha: input.currentHeadSha
      };
    }

    if (reviewRun.headSha !== input.currentHeadSha) {
      const supersededRun = this.replaceReviewRun({
        ...reviewRun,
        status: "superseded",
        finishedAt: reviewRun.finishedAt ?? new Date(),
        errorCode: "current_head_sha_changed",
        errorMessage: `Skipped publishing because current PR head is ${input.currentHeadSha}`
      });

      return {
        publishable: false,
        reason: "head_sha_changed",
        reviewRun: supersededRun,
        currentHeadSha: input.currentHeadSha
      };
    }

    return {
      publishable: true,
      reason: null,
      reviewRun,
      currentHeadSha: input.currentHeadSha
    };
  }

  private replaceReviewRun(updatedReviewRun: ReviewRunRecord): ReviewRunRecord {
    const index = this.reviewRuns.findIndex((reviewRun) => reviewRun.id === updatedReviewRun.id);

    if (index >= 0) {
      this.reviewRuns[index] = updatedReviewRun;
    }

    return updatedReviewRun;
  }
}
