import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import { WORKER_REVIEW_JOB_INPUT_SCHEMA_VERSION, type ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG } from "../../../config/api-config.provider";
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

const GITHUB_SIGNATURE_PREFIX = "sha256=";

@Injectable()
export class GitHubWebhookService {
  constructor(
    @Inject(GITHUB_WEBHOOK_SECRET) private readonly webhookSecret: string,
    @Inject(GITHUB_WEBHOOK_STORE) private readonly store: GitHubWebhookStore,
    @Inject(REVIEW_QUEUE) private readonly reviewQueue: ReviewQueueProducer,
    @Inject(API_RUNTIME_CONFIG) private readonly config: ApiRuntimeConfig
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
    const metadata = eventName === "pull_request" ? readPullRequestEventMetadata(payload) : null;
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
}
