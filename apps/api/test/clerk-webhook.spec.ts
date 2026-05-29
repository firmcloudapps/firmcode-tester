import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import type { WebhookEvent } from "@clerk/backend";
import {
  ClerkWebhookService,
  type ClerkOrganizationMembershipClient,
  type ClerkWebhookVerifier
} from "../src/modules/webhooks/clerk/clerk-webhook.service";

describe("ClerkWebhookService", () => {
  it("adds newly created Clerk users to the Firmcode AI organization as Developer", async () => {
    const verifier = new FakeClerkWebhookVerifier(userCreatedEvent("user_new"));
    const membershipClient = new FakeMembershipClient("created");
    const service = new ClerkWebhookService(testConfig(), verifier, membershipClient);

    const receipt = await service.acceptDelivery({
      rawBody: Buffer.from(JSON.stringify({ type: "user.created" })),
      headers: {
        "svix-id": "msg_1",
        "svix-timestamp": "1779816487481",
        "svix-signature": "v1,signature"
      }
    });

    expect(receipt).toEqual({
      status: "accepted",
      eventName: "user.created",
      userId: "user_new",
      organizationId: "org_3EGsxXDTl8pWEfV6da6oENrYhRr",
      membershipStatus: "created",
      ignored: false,
      reason: null
    });
    expect(verifier.signingSecrets).toEqual(["whsec_test"]);
    expect(membershipClient.calls).toEqual([
      {
        organization: {
          id: "org_3EGsxXDTl8pWEfV6da6oENrYhRr",
          name: "Firmcode AI",
          role: "org:developer"
        },
        userId: "user_new"
      }
    ]);
  });

  it("keeps Clerk webhooks idempotent when the user is already a member", async () => {
    const service = new ClerkWebhookService(
      testConfig(),
      new FakeClerkWebhookVerifier(userCreatedEvent("user_existing")),
      new FakeMembershipClient("already_member")
    );

    await expect(
      service.acceptDelivery({
        rawBody: Buffer.from("{}"),
        headers: {}
      })
    ).resolves.toMatchObject({
      membershipStatus: "already_member",
      ignored: false
    });
  });

  it("accepts the webhook without retrying forever when membership provisioning fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const membershipClient = new FailingMembershipClient(new Error("role org:developer does not exist"));
    const service = new ClerkWebhookService(testConfig(), new FakeClerkWebhookVerifier(userCreatedEvent("user_new")), membershipClient);

    try {
      const receipt = await service.acceptDelivery({
        rawBody: Buffer.from("{}"),
        headers: {}
      });

      expect(receipt).toMatchObject({
        status: "accepted",
        eventName: "user.created",
        userId: "user_new",
        organizationId: "org_3EGsxXDTl8pWEfV6da6oENrYhRr",
        membershipStatus: "failed",
        ignored: false,
        reason: "membership_error"
      });
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(String(errorSpy.mock.calls[0]![0])).toContain("clerk.default_organization.membership_failed");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("ignores unsupported Clerk webhook events", async () => {
    const membershipClient = new FakeMembershipClient("created");
    const service = new ClerkWebhookService(testConfig(), new FakeClerkWebhookVerifier(userUpdatedEvent("user_1")), membershipClient);

    await expect(
      service.acceptDelivery({
        rawBody: Buffer.from("{}"),
        headers: {}
      })
    ).resolves.toMatchObject({
      eventName: "user.updated",
      membershipStatus: "skipped",
      ignored: true,
      reason: "unsupported_event"
    });
    expect(membershipClient.calls).toEqual([]);
  });

  it("requires raw request bodies so Clerk signatures can be verified", async () => {
    const service = new ClerkWebhookService(
      testConfig(),
      new FakeClerkWebhookVerifier(userCreatedEvent("user_new")),
      new FakeMembershipClient("created")
    );

    await expect(service.acceptDelivery({ rawBody: null, headers: {} })).rejects.toBeInstanceOf(BadRequestException);
  });
});

class FakeClerkWebhookVerifier implements ClerkWebhookVerifier {
  readonly signingSecrets: string[] = [];

  constructor(private readonly event: WebhookEvent) { }

  async verify(input: { readonly signingSecret: string }): Promise<WebhookEvent> {
    this.signingSecrets.push(input.signingSecret);
    return this.event;
  }
}

class FakeMembershipClient implements ClerkOrganizationMembershipClient {
  readonly calls: Array<Parameters<ClerkOrganizationMembershipClient["ensureMembership"]>[0]> = [];

  constructor(private readonly result: "already_member" | "created") { }

  async ensureMembership(input: Parameters<ClerkOrganizationMembershipClient["ensureMembership"]>[0]): Promise<"already_member" | "created"> {
    this.calls.push(input);
    return this.result;
  }
}

class FailingMembershipClient implements ClerkOrganizationMembershipClient {
  constructor(private readonly error: Error) { }

  async ensureMembership(): Promise<"already_member" | "created"> {
    throw this.error;
  }
}

function userCreatedEvent(userId: string): WebhookEvent {
  return {
    type: "user.created",
    data: { id: userId }
  } as WebhookEvent;
}

function userUpdatedEvent(userId: string): WebhookEvent {
  return {
    type: "user.updated",
    data: { id: userId }
  } as WebhookEvent;
}

function testConfig(): ApiRuntimeConfig {
  return {
    nodeEnv: "test",
    port: 3001,
    corsAllowedOrigins: [],
    database: {
      url: "postgres://firmcode:secret@localhost:5432/firmcode",
      ssl: false,
      redactedUrl: "postgres://firmcode:REDACTED@localhost:5432/firmcode"
    },
    queue: {
      redisUrl: "redis://localhost:6379",
      redactedRedisUrl: "redis://localhost:6379/"
    },
    clerk: {
      secretKey: "sk_test_example",
      jwtAudience: "firmcode-api",
      webhookSecret: "whsec_test",
      defaultOrganization: {
        id: "org_3EGsxXDTl8pWEfV6da6oENrYhRr",
        name: "Firmcode AI",
        role: "org:developer"
      }
    },
    github: null,
    review: {
      dryRun: true,
      skipDraftPullRequests: true,
      ciLogMaxBytes: 20_000,
      artifactRetentionDays: 21,
      largePullRequest: {
        maxChangedFiles: 100,
        maxDiffBytes: 250_000,
        maxChangedLines: 3_000,
        maxEstimatedTokens: 30_000,
        maxFilesAfterFiltering: 60,
        maxSemgrepRuntimeMs: 30_000,
        summaryOnlyDiffBytes: 750_000,
        summaryOnlyChangedLines: 10_000,
        summaryOnlyEstimatedTokens: 90_000,
        maxFullContextFiles: 30
      }
    },
    codebaseScan: {
      defaultCadenceHours: 24
    }
  };
}
