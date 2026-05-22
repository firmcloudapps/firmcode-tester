import { type INestApplication, UnauthorizedException } from "@nestjs/common";
import { HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { createHmac } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import { createApiRuntimeConfig, type EnvironmentVariables } from "@firmcode/shared";
import { createApiApplication } from "../src/main";
import { GitHubWebhookController } from "../src/modules/webhooks/github/github-webhook.controller";
import { GitHubWebhookService } from "../src/modules/webhooks/github/github-webhook.service";
import {
  GITHUB_WEBHOOK_STORE,
  InMemoryGitHubWebhookStore
} from "../src/modules/webhooks/github/github-webhook.store";

const WEBHOOK_SECRET = "github_webhook_secret";
const FIXTURE_DIR = join(__dirname, "fixtures", "github-webhooks");
const RAW_PRIVATE_KEY = [
  "-----BEGIN RSA PRIVATE KEY-----",
  "MIIBOgIBAAJBANotARealKeyButValidPemShapeForConfigTests",
  "-----END RSA PRIVATE KEY-----"
].join("\n");

const API_ENV: EnvironmentVariables = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://firmcode:secret@localhost:5432/firmcode",
  DATABASE_SSL: "false",
  REDIS_URL: "redis://localhost:6379",
  CLERK_SECRET_KEY: "sk_test_example",
  GITHUB_APP_ID: "12345",
  GITHUB_APP_PRIVATE_KEY: RAW_PRIVATE_KEY,
  GITHUB_WEBHOOK_SECRET: WEBHOOK_SECRET,
  GITHUB_CLIENT_ID: "github_client_id",
  GITHUB_CLIENT_SECRET: "github_client_secret"
};

async function readFixture(name: string): Promise<Buffer> {
  return readFile(join(FIXTURE_DIR, name));
}

function signPayload(payload: Buffer, secret = WEBHOOK_SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

describe("GitHubWebhookService", () => {
  let store: InMemoryGitHubWebhookStore;
  let service: GitHubWebhookService;

  beforeEach(() => {
    store = new InMemoryGitHubWebhookStore();
    service = new GitHubWebhookService(WEBHOOK_SECRET, store, createApiRuntimeConfig(API_ENV));
  });

  it("accepts fixture payloads with valid signatures", async () => {
    const rawBody = await readFixture("pull_request.opened.json");

    expect(
      service.acceptDelivery({
        rawBody,
        signature: signPayload(rawBody),
        eventName: "pull_request",
        deliveryId: "delivery-valid-signature"
      })
    ).toMatchObject({
      status: "accepted",
      eventName: "pull_request",
      action: "opened",
      supported: true,
      deliveryId: "delivery-valid-signature",
      duplicate: false,
      ignored: false,
      reason: null,
      jobId: "delivery-valid-signature"
    });
  });

  it("rejects fixture payloads with invalid signatures", async () => {
    const rawBody = await readFixture("pull_request.opened.json");

    expect(() =>
      service.acceptDelivery({
        rawBody,
        signature: signPayload(rawBody, "wrong_secret"),
        eventName: "pull_request",
        deliveryId: "delivery-invalid-signature"
      })
    ).toThrow(UnauthorizedException);
  });

  it("rejects fixture payloads with missing signatures", async () => {
    const rawBody = await readFixture("pull_request.opened.json");

    expect(() =>
      service.acceptDelivery({
        rawBody,
        signature: undefined,
        eventName: "pull_request",
        deliveryId: "delivery-missing-signature"
      })
    ).toThrow(UnauthorizedException);
  });

  it("verifies signatures before parsing fixture payloads", async () => {
    const rawBody = await readFixture("malformed.json");

    expect(() =>
      service.acceptDelivery({
        rawBody,
        signature: signPayload(rawBody, "wrong_secret"),
        eventName: "pull_request",
        deliveryId: "delivery-malformed"
      })
    ).toThrow(UnauthorizedException);
  });

  it.each([
    ["pull_request.opened.json", "opened", "abc123def456"],
    ["pull_request.synchronize.json", "synchronize", "fed456cba123"],
    ["pull_request.reopened.json", "reopened", "abc123def456"],
    ["pull_request.ready_for_review.json", "ready_for_review", "abc123def456"]
  ])("normalizes %s into upserts, one review run, and one job", async (fixture, action, headSha) => {
    const rawBody = await readFixture(fixture);
    const receipt = service.acceptDelivery({
      rawBody,
      signature: signPayload(rawBody),
      eventName: "pull_request",
      deliveryId: `delivery-${action}`
    });

    expect(receipt).toMatchObject({
      status: "accepted",
      eventName: "pull_request",
      action,
      supported: true,
      deliveryId: `delivery-${action}`,
      duplicate: false,
      ignored: false,
      reason: null,
      jobId: `delivery-${action}`
    });
    expect(receipt.reviewRunId).toEqual(expect.any(String));
    expect(store.installations.size).toBe(1);
    expect(store.repositories.size).toBe(1);
    expect(store.pullRequests.size).toBe(1);
    expect(store.reviewRuns).toHaveLength(1);
    expect(store.reviewRuns[0]).toMatchObject({
      deliveryId: `delivery-${action}`,
      triggerEvent: `pull_request.${action}`,
      headSha,
      status: "queued"
    });
    expect(store.reviewJobs.get(`delivery-${action}`)).toMatchObject({
      deliveryId: `delivery-${action}`,
      reviewRunId: receipt.reviewRunId,
      pullRequestNumber: 7,
      headSha,
      triggerEvent: `pull_request.${action}`
    });
    expect(store.deliveries.get(`delivery-${action}`)).toMatchObject({
      deliveryId: `delivery-${action}`,
      eventName: "pull_request",
      action,
      installationId: 101,
      repositoryId: 202,
      pullRequestNumber: 7,
      headSha,
      status: "processed"
    });
  });

  it("does not create duplicate review runs or jobs for a repeated delivery ID", async () => {
    const rawBody = await readFixture("pull_request.opened.json");
    const firstReceipt = service.acceptDelivery({
      rawBody,
      signature: signPayload(rawBody),
      eventName: "pull_request",
      deliveryId: "delivery-duplicate"
    });
    const duplicateReceipt = service.acceptDelivery({
      rawBody,
      signature: signPayload(rawBody),
      eventName: "pull_request",
      deliveryId: "delivery-duplicate"
    });

    expect(firstReceipt).toMatchObject({
      duplicate: false,
      ignored: false,
      jobId: "delivery-duplicate"
    });
    expect(duplicateReceipt).toEqual({
      status: "accepted",
      eventName: "pull_request",
      action: "opened",
      supported: true,
      deliveryId: "delivery-duplicate",
      duplicate: true,
      ignored: true,
      reason: "duplicate_delivery",
      reviewRunId: null,
      jobId: null
    });
    expect(store.deliveries.size).toBe(1);
    expect(store.reviewRuns).toHaveLength(1);
    expect(store.reviewJobs.size).toBe(1);
  });

  it("upserts draft pull requests but skips review jobs by default", async () => {
    const rawBody = await readFixture("pull_request.opened.draft.json");
    const receipt = service.acceptDelivery({
      rawBody,
      signature: signPayload(rawBody),
      eventName: "pull_request",
      deliveryId: "delivery-draft"
    });

    expect(receipt).toEqual({
      status: "accepted",
      eventName: "pull_request",
      action: "opened",
      supported: true,
      deliveryId: "delivery-draft",
      duplicate: false,
      ignored: true,
      reason: "draft_pull_request",
      reviewRunId: null,
      jobId: null
    });
    expect(store.installations.size).toBe(1);
    expect(store.repositories.size).toBe(1);
    expect(store.pullRequests.size).toBe(1);
    expect(store.reviewRuns).toHaveLength(0);
    expect(store.reviewJobs.size).toBe(0);
  });

  it("creates a review run for draft pull requests when configured", async () => {
    const rawBody = await readFixture("pull_request.opened.draft.json");
    const draftStore = new InMemoryGitHubWebhookStore();
    const draftService = new GitHubWebhookService(WEBHOOK_SECRET, draftStore, {
      ...createApiRuntimeConfig(API_ENV),
      review: {
        skipDraftPullRequests: false
      }
    });
    const receipt = draftService.acceptDelivery({
      rawBody,
      signature: signPayload(rawBody),
      eventName: "pull_request",
      deliveryId: "delivery-draft-enabled"
    });

    expect(receipt).toMatchObject({
      duplicate: false,
      ignored: false,
      reason: null,
      jobId: "delivery-draft-enabled"
    });
    expect(draftStore.reviewRuns).toHaveLength(1);
    expect(draftStore.reviewJobs.size).toBe(1);
  });
});

describe("POST /webhooks/github", () => {
  const originalEnv = { ...process.env };
  let app: INestApplication;
  let controller: GitHubWebhookController;
  let store: InMemoryGitHubWebhookStore;

  beforeAll(async () => {
    Object.assign(process.env, API_ENV);
    app = await createApiApplication(createApiRuntimeConfig(API_ENV));
    await app.init();
    controller = app.get(GitHubWebhookController);
    store = app.get(GITHUB_WEBHOOK_STORE);
  });

  afterAll(async () => {
    await app.close();
    process.env = originalEnv;
  });

  it("returns 202 for supported events", async () => {
    const rawBody = await readFixture("pull_request.opened.json");

    expect(Reflect.getMetadata(HTTP_CODE_METADATA, GitHubWebhookController.prototype.acceptGitHubWebhook)).toBe(202);
    expect(controller.acceptGitHubWebhook(rawBody, signPayload(rawBody), "pull_request", "controller-supported")).toMatchObject({
      status: "accepted",
      eventName: "pull_request",
      action: "opened",
      supported: true,
      deliveryId: "controller-supported",
      duplicate: false,
      ignored: false,
      jobId: "controller-supported"
    });
    expect(store.reviewRuns).toHaveLength(1);
  });

  it("returns 202 for unsupported events", async () => {
    const rawBody = await readFixture("issues.opened.json");

    expect(Reflect.getMetadata(HTTP_CODE_METADATA, GitHubWebhookController.prototype.acceptGitHubWebhook)).toBe(202);
    expect(controller.acceptGitHubWebhook(rawBody, signPayload(rawBody), "issues", "controller-unsupported")).toEqual({
      status: "accepted",
      eventName: "issues",
      action: "opened",
      supported: false,
      deliveryId: "controller-unsupported",
      duplicate: false,
      ignored: true,
      reason: "unsupported_event",
      reviewRunId: null,
      jobId: null
    });
  });

  it("returns 401 for invalid signatures", async () => {
    const rawBody = await readFixture("pull_request.opened.json");

    expect(() =>
      controller.acceptGitHubWebhook(
        rawBody,
        signPayload(rawBody, "wrong_secret"),
        "pull_request",
        "controller-invalid-signature"
      )
    ).toThrow(UnauthorizedException);
  });

  it("returns 401 for missing signatures", async () => {
    const rawBody = await readFixture("pull_request.opened.json");

    expect(() =>
      controller.acceptGitHubWebhook(rawBody, undefined, "pull_request", "controller-missing-signature")
    ).toThrow(UnauthorizedException);
  });
});
