import { BadRequestException, Inject, Injectable, Optional, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import { WORKER_REVIEW_JOB_INPUT_SCHEMA_VERSION, type ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG } from "../../../config/api-config.provider";
import {
  GITHUB_PUSH_PR_RESOLVER,
  NoopGitHubPushPullRequestResolver,
  type GitHubAssociatedPullRequest,
  type GitHubPushPullRequestResolver
} from "../../../infrastructure/github/github-push-pr-resolver";
import {
  GITHUB_PR_ACTIVITY_PUBLISHER,
  NoopGitHubPullRequestActivityPublisher,
  type GitHubPullRequestActivityPublisher
} from "../../../infrastructure/github/github-pr-activity-publisher";
import { REVIEW_QUEUE, type ReviewQueueProducer } from "../../queues/review-queue";
import { isSupportedGitHubWebhookEvent } from "./github-webhook.events";
import { GITHUB_WEBHOOK_STORE, type GitHubWebhookStore } from "./github-webhook.store";
import { normalizePullRequestEvent, readPullRequestEventMetadata } from "./pull-request-event.normalizer";

export const GITHUB_WEBHOOK_SECRET = Symbol("GITHUB_WEBHOOK_SECRET");

export interface GitHubWebhookDeliveryInput {
  readonly rawBody: Buffer | null;
  readonly signature: string | string[] | undefined;
  readonly eventName: string | string[] | undefined;
  readonly deliveryId: string | string[] | undefined;
}

export interface GitHubWebhookReceipt {
  readonly status: "accepted";
  readonly eventName: string;
  readonly action: string | null;
  readonly supported: boolean;
  readonly deliveryId: string;
  readonly duplicate: boolean;
  readonly ignored: boolean;
  readonly reason: string | null;
  readonly reviewRunId: string | null;
  readonly jobId: string | null;
}

type JsonObject = Record<string, unknown>;

interface GitHubWebhookPayload extends JsonObject {
  readonly action?: unknown;
}

interface NormalizedPushEvent {
  readonly installation: {
    readonly installationId: number;
    readonly accountLogin: string | null;
    readonly accountType: string | null;
    readonly permissionsJson: Record<string, unknown>;
  };
  readonly repository: {
    readonly githubRepositoryId: number;
    readonly owner: string;
    readonly name: string;
    readonly fullName: string;
    readonly private: boolean;
    readonly defaultBranch: string;
  };
  readonly ref: string;
  readonly afterSha: string;
  readonly deleted: boolean;
}

const GITHUB_SIGNATURE_PREFIX = "sha256=";
const EMPTY_GIT_SHA = "0000000000000000000000000000000000000000";

@Injectable()
export class GitHubWebhookService {
  constructor(
    @Inject(GITHUB_WEBHOOK_SECRET) private readonly webhookSecret: string,
    @Inject(GITHUB_WEBHOOK_STORE) private readonly store: GitHubWebhookStore,
    @Inject(REVIEW_QUEUE) private readonly reviewQueue: ReviewQueueProducer,
    @Inject(API_RUNTIME_CONFIG) private readonly config: ApiRuntimeConfig,
    @Optional()
    @Inject(GITHUB_PR_ACTIVITY_PUBLISHER)
    private readonly activityPublisher: GitHubPullRequestActivityPublisher = new NoopGitHubPullRequestActivityPublisher(),
    @Optional()
    @Inject(GITHUB_PUSH_PR_RESOLVER)
    private readonly pushPullRequestResolver: GitHubPushPullRequestResolver = new NoopGitHubPushPullRequestResolver()
  ) {}

  async acceptDelivery(input: GitHubWebhookDeliveryInput): Promise<GitHubWebhookReceipt> {
    this.verifySignature(input.signature, input.rawBody);

    if (input.rawBody === null) {
      throw new BadRequestException("GitHub webhook raw body is required");
    }

    const payload = this.parsePayload(input.rawBody);
    const eventName = this.readSingleHeader(input.eventName) ?? "unknown";
    const action = typeof payload.action === "string" ? payload.action : null;
    const deliveryId = this.readDeliveryId(input.deliveryId);
    const supported = isSupportedGitHubWebhookEvent({ eventName, action });
    const metadata =
      eventName === "pull_request"
        ? readPullRequestEventMetadata(payload)
        : eventName === "push"
          ? readPushEventMetadata(payload)
          : null;
    const deliveryResult = await this.store.createDelivery({
      deliveryId,
      eventName,
      action,
      installationId: metadata?.installationId ?? null,
      repositoryId: metadata?.repositoryId ?? null,
      pullRequestNumber: metadata?.pullRequestNumber ?? null,
      headSha: metadata?.headSha ?? null
    });

    if (!deliveryResult.created) {
      const originalDelivery = deliveryResult.delivery;
      const originalSupported = isSupportedGitHubWebhookEvent({
        eventName: originalDelivery.eventName,
        action: originalDelivery.action
      });

      return {
        status: "accepted",
        eventName: originalDelivery.eventName,
        action: originalDelivery.action,
        supported: originalSupported,
        deliveryId: originalDelivery.deliveryId,
        duplicate: true,
        ignored: true,
        reason: "duplicate_delivery",
        reviewRunId: null,
        jobId: null
      };
    }

    if (!supported) {
      await this.store.markDeliveryProcessed(deliveryId, "ignored");

      return {
        status: "accepted",
        eventName,
        action,
        supported,
        deliveryId,
        duplicate: false,
        ignored: true,
        reason: "unsupported_event",
        reviewRunId: null,
        jobId: null
      };
    }

    if (eventName === "push") {
      return this.acceptPushDelivery({ payload, deliveryId, eventName, action });
    }

    if (eventName !== "pull_request") {
      await this.store.markDeliveryProcessed(deliveryId, "ignored");

      return {
        status: "accepted",
        eventName,
        action,
        supported,
        deliveryId,
        duplicate: false,
        ignored: true,
        reason: "normalizer_not_configured",
        reviewRunId: null,
        jobId: null
      };
    }

    try {
      const normalized = normalizePullRequestEvent(payload);
      const installation = await this.store.upsertInstallation(normalized.installation);
      const repository = await this.store.upsertRepository({
        ...normalized.repository,
        installationId: installation.id,
        enabled: true
      });
      const pullRequest = await this.store.upsertPullRequest({
        ...normalized.pullRequest,
        repositoryId: repository.id
      });

      if (pullRequest.draft && this.config.review.skipDraftPullRequests) {
        await this.store.markDeliveryProcessed(deliveryId, "ignored");

        return {
          status: "accepted",
          eventName,
          action,
          supported,
          deliveryId,
          duplicate: false,
          ignored: true,
          reason: "draft_pull_request",
          reviewRunId: null,
          jobId: null
        };
      }

      if (action === "synchronize") {
        await this.store.supersedeQueuedOrRunningReviewRuns({
          pullRequestId: pullRequest.id,
          headSha: pullRequest.headSha,
          supersededByDeliveryId: deliveryId
        });
      }

      const triggerEvent = `${eventName}.${action}`;
      const reviewRun = await this.store.createReviewRun({
        repositoryId: repository.id,
        pullRequestId: pullRequest.id,
        deliveryId,
        triggerEvent,
        headSha: pullRequest.headSha
      });
      const job = await this.reviewQueue.enqueuePullRequestReview({
        schemaVersion: WORKER_REVIEW_JOB_INPUT_SCHEMA_VERSION,
        deliveryId,
        reviewRunId: reviewRun.id,
        repositoryId: repository.id,
        pullRequestId: pullRequest.id,
        pullRequestNumber: pullRequest.number,
        headSha: pullRequest.headSha,
        triggerEvent
      });

      await this.publishScanningActivity({
        installationId: installation.installationId,
        repositoryFullName: repository.fullName,
        pullRequestNumber: pullRequest.number,
        reviewRunId: reviewRun.id,
        headSha: pullRequest.headSha,
        triggerEvent
      });

      await this.store.markDeliveryProcessed(deliveryId, "processed");

      return {
        status: "accepted",
        eventName,
        action,
        supported,
        deliveryId,
        duplicate: false,
        ignored: false,
        reason: null,
        reviewRunId: reviewRun.id,
        jobId: job.id
      };
    } catch (error) {
      await this.store.markDeliveryProcessed(deliveryId, "failed", error instanceof Error ? error.message : "unknown error");
      throw error;
    }
  }

  private verifySignature(signatureHeader: string | string[] | undefined, rawBody: Buffer | null): void {
    const signature = this.readSingleHeader(signatureHeader);

    if (!signature?.startsWith(GITHUB_SIGNATURE_PREFIX)) {
      throw new UnauthorizedException("Invalid GitHub webhook signature");
    }

    if (rawBody === null) {
      throw new BadRequestException("GitHub webhook raw body is required");
    }

    const expectedSignature = `${GITHUB_SIGNATURE_PREFIX}${createHmac("sha256", this.webhookSecret)
      .update(rawBody)
      .digest("hex")}`;
    const expected = Buffer.from(expectedSignature, "utf8");
    const actual = Buffer.from(signature, "utf8");

    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new UnauthorizedException("Invalid GitHub webhook signature");
    }
  }

  private parsePayload(rawBody: Buffer): GitHubWebhookPayload {
    try {
      const payload: unknown = JSON.parse(rawBody.toString("utf8"));

      if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
        return payload as GitHubWebhookPayload;
      }
    } catch {
      // Reported below with a stable message.
    }

    throw new BadRequestException("GitHub webhook payload must be a JSON object");
  }

  private readSingleHeader(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return value ?? null;
  }

  private readDeliveryId(value: string | string[] | undefined): string {
    const deliveryId = this.readSingleHeader(value);

    if (deliveryId === null || deliveryId.trim().length === 0) {
      throw new BadRequestException("GitHub delivery ID is required");
    }

    return deliveryId;
  }

  private async publishScanningActivity(input: {
    readonly installationId: number;
    readonly repositoryFullName: string;
    readonly pullRequestNumber: number;
    readonly reviewRunId: string;
    readonly headSha: string;
    readonly triggerEvent: string;
  }): Promise<void> {
    try {
      await this.activityPublisher.publishScanningActivity({
        ...input,
        status: "queued"
      });
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "github.activity.publish_failed",
          activity: "scanning",
          repositoryFullName: input.repositoryFullName,
          pullRequestNumber: input.pullRequestNumber,
          reviewRunId: input.reviewRunId,
          error: error instanceof Error ? error.name : "UnknownError",
          status: typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : null,
          message: error instanceof Error ? error.message : "Unknown publishing error"
        })
      );
    }
  }

  private async acceptPushDelivery(input: {
    readonly payload: GitHubWebhookPayload;
    readonly deliveryId: string;
    readonly eventName: string;
    readonly action: string | null;
  }): Promise<GitHubWebhookReceipt> {
    try {
      const normalized = normalizePushEvent(input.payload);

      if (normalized.deleted || normalized.afterSha === EMPTY_GIT_SHA) {
        await this.store.markDeliveryProcessed(input.deliveryId, "ignored");

        return {
          status: "accepted",
          eventName: input.eventName,
          action: input.action,
          supported: true,
          deliveryId: input.deliveryId,
          duplicate: false,
          ignored: true,
          reason: "deleted_ref",
          reviewRunId: null,
          jobId: null
        };
      }

      if (!normalized.ref.startsWith("refs/heads/")) {
        await this.store.markDeliveryProcessed(input.deliveryId, "ignored");

        return {
          status: "accepted",
          eventName: input.eventName,
          action: input.action,
          supported: true,
          deliveryId: input.deliveryId,
          duplicate: false,
          ignored: true,
          reason: "non_branch_push",
          reviewRunId: null,
          jobId: null
        };
      }

      const associatedPullRequests = await this.pushPullRequestResolver.resolveAssociatedPullRequests({
        installationId: normalized.installation.installationId,
        repositoryFullName: normalized.repository.fullName,
        commitSha: normalized.afterSha
      });
      const associatedPullRequest = choosePushPullRequest(associatedPullRequests, normalized.afterSha);

      if (associatedPullRequest === null) {
        await this.store.markDeliveryProcessed(input.deliveryId, "ignored");

        return {
          status: "accepted",
          eventName: input.eventName,
          action: input.action,
          supported: true,
          deliveryId: input.deliveryId,
          duplicate: false,
          ignored: true,
          reason: "no_associated_pull_request",
          reviewRunId: null,
          jobId: null
        };
      }

      const installation = await this.store.upsertInstallation(normalized.installation);
      const repository = await this.store.upsertRepository({
        ...normalized.repository,
        installationId: installation.id,
        enabled: true
      });
      const pullRequest = await this.store.upsertPullRequest({
        ...associatedPullRequest,
        repositoryId: repository.id
      });

      if (pullRequest.draft && this.config.review.skipDraftPullRequests) {
        await this.store.markDeliveryProcessed(input.deliveryId, "ignored");

        return {
          status: "accepted",
          eventName: input.eventName,
          action: input.action,
          supported: true,
          deliveryId: input.deliveryId,
          duplicate: false,
          ignored: true,
          reason: "draft_pull_request",
          reviewRunId: null,
          jobId: null
        };
      }

      await this.store.supersedeQueuedOrRunningReviewRuns({
        pullRequestId: pullRequest.id,
        headSha: pullRequest.headSha,
        supersededByDeliveryId: input.deliveryId
      });

      const triggerEvent = "push";
      const reviewRun = await this.store.createReviewRun({
        repositoryId: repository.id,
        pullRequestId: pullRequest.id,
        deliveryId: input.deliveryId,
        triggerEvent,
        headSha: pullRequest.headSha
      });
      const job = await this.reviewQueue.enqueuePullRequestReview({
        schemaVersion: WORKER_REVIEW_JOB_INPUT_SCHEMA_VERSION,
        deliveryId: input.deliveryId,
        reviewRunId: reviewRun.id,
        repositoryId: repository.id,
        pullRequestId: pullRequest.id,
        pullRequestNumber: pullRequest.number,
        headSha: pullRequest.headSha,
        triggerEvent
      });

      await this.publishScanningActivity({
        installationId: installation.installationId,
        repositoryFullName: repository.fullName,
        pullRequestNumber: pullRequest.number,
        reviewRunId: reviewRun.id,
        headSha: pullRequest.headSha,
        triggerEvent
      });

      await this.store.markDeliveryProcessed(input.deliveryId, "processed");

      return {
        status: "accepted",
        eventName: input.eventName,
        action: input.action,
        supported: true,
        deliveryId: input.deliveryId,
        duplicate: false,
        ignored: false,
        reason: null,
        reviewRunId: reviewRun.id,
        jobId: job.id
      };
    } catch (error) {
      await this.store.markDeliveryProcessed(input.deliveryId, "failed", error instanceof Error ? error.message : "unknown error");
      throw error;
    }
  }
}

function choosePushPullRequest(
  pullRequests: readonly GitHubAssociatedPullRequest[],
  pushedHeadSha: string
): GitHubAssociatedPullRequest | null {
  const openPullRequests = pullRequests.filter((pullRequest) => pullRequest.state === "open");
  const exactHeadMatch = openPullRequests.find((pullRequest) => pullRequest.headSha === pushedHeadSha);
  return exactHeadMatch ?? openPullRequests[0] ?? null;
}

function readPushEventMetadata(payload: JsonObject): {
  installationId: number | null;
  repositoryId: number | null;
  pullRequestNumber: number | null;
  headSha: string | null;
} {
  const installation = readOptionalObject(payload, "installation");
  const repository = readOptionalObject(payload, "repository");

  return {
    installationId: readOptionalNumber(installation, "id"),
    repositoryId: readOptionalNumber(repository, "id"),
    pullRequestNumber: null,
    headSha: readOptionalString(payload, "after")
  };
}

function normalizePushEvent(payload: JsonObject): NormalizedPushEvent {
  const installation = readObject(payload, "installation");
  const repository = readObject(payload, "repository");
  const fullName = readString(repository, "full_name");
  const [ownerFromName, nameFromFullName] = splitRepositoryFullName(fullName);
  const repositoryOwner = readOptionalObject(repository, "owner");
  const installationAccount = readOptionalObject(installation, "account");
  const permissions = readOptionalObject(installation, "permissions") ?? {};

  return {
    installation: {
      installationId: readNumber(installation, "id"),
      accountLogin: readOptionalString(installationAccount, "login") ?? readOptionalString(repositoryOwner, "login"),
      accountType: readOptionalString(installationAccount, "type") ?? readOptionalString(repositoryOwner, "type"),
      permissionsJson: permissions
    },
    repository: {
      githubRepositoryId: readNumber(repository, "id"),
      owner: readOptionalString(repositoryOwner, "login") ?? ownerFromName,
      name: readOptionalString(repository, "name") ?? nameFromFullName,
      fullName,
      private: readOptionalBoolean(repository, "private") ?? false,
      defaultBranch: readOptionalString(repository, "default_branch") ?? "main"
    },
    ref: readString(payload, "ref"),
    afterSha: readString(payload, "after"),
    deleted: readOptionalBoolean(payload, "deleted") ?? false
  };
}

function splitRepositoryFullName(value: string): [string, string] {
  const [owner, name] = value.split("/");

  if (!owner || !name) {
    throw new BadRequestException("GitHub push repository.full_name must be owner/name");
  }

  return [owner, name];
}

function readObject(source: JsonObject, key: string): JsonObject {
  const value = source[key];

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }

  throw new BadRequestException(`GitHub push payload is missing ${key}`);
}

function readOptionalObject(source: JsonObject | null, key: string): JsonObject | null {
  if (source === null) {
    return null;
  }

  const value = source[key];

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }

  return null;
}

function readString(source: JsonObject, key: string): string {
  const value = source[key];

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new BadRequestException(`GitHub push payload is missing ${key}`);
}

function readNumber(source: JsonObject, key: string): number {
  const value = source[key];

  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  throw new BadRequestException(`GitHub push payload is missing ${key}`);
}

function readOptionalString(source: JsonObject | null, key: string): string | null {
  if (source === null) {
    return null;
  }

  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readOptionalNumber(source: JsonObject | null, key: string): number | null {
  if (source === null) {
    return null;
  }

  const value = source[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function readOptionalBoolean(source: JsonObject, key: string): boolean | null {
  const value = source[key];
  return typeof value === "boolean" ? value : null;
}
