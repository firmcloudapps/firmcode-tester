import { randomUUID } from "crypto";
import type { ReviewRunStatus } from "@firmcode/shared";

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

export interface ReviewJobInput {
  deliveryId: string;
  reviewRunId: string;
  repositoryId: string;
  pullRequestId: string;
  pullRequestNumber: number;
  headSha: string;
  triggerEvent: string;
}

export interface ReviewJobRecord extends ReviewJobInput {
  id: string;
  name: "review.pull_request";
  createdAt: Date;
}

export interface GitHubWebhookStore {
  createDelivery(input: GitHubDeliveryInput): { created: boolean; delivery: GitHubDeliveryRecord };
  markDeliveryProcessed(deliveryId: string, status: Exclude<GitHubDeliveryStatus, "processing">, error?: string): void;
  upsertInstallation(input: GitHubInstallationUpsert): GitHubInstallationRecord;
  upsertRepository(input: RepositoryUpsert): RepositoryRecord;
  upsertPullRequest(input: PullRequestUpsert): PullRequestRecord;
  createReviewRun(input: ReviewRunInput): ReviewRunRecord;
  enqueuePullRequestReview(input: ReviewJobInput): ReviewJobRecord;
}

export const GITHUB_WEBHOOK_STORE = Symbol("GITHUB_WEBHOOK_STORE");

export class InMemoryGitHubWebhookStore implements GitHubWebhookStore {
  readonly deliveries = new Map<string, GitHubDeliveryRecord>();
  readonly installations = new Map<number, GitHubInstallationRecord>();
  readonly repositories = new Map<number, RepositoryRecord>();
  readonly pullRequests = new Map<string, PullRequestRecord>();
  readonly reviewRuns: ReviewRunRecord[] = [];
  readonly reviewJobs = new Map<string, ReviewJobRecord>();

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

  enqueuePullRequestReview(input: ReviewJobInput): ReviewJobRecord {
    const existing = this.reviewJobs.get(input.deliveryId);

    if (existing !== undefined) {
      return existing;
    }

    const job: ReviewJobRecord = {
      id: input.deliveryId,
      name: "review.pull_request",
      ...input,
      createdAt: new Date()
    };
    this.reviewJobs.set(input.deliveryId, job);

    return job;
  }
}
