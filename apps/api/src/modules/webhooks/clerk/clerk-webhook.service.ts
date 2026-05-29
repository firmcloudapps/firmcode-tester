import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { createClerkClient, type ClerkClient, type WebhookEvent } from "@clerk/backend";
import { verifyWebhook } from "@clerk/backend/webhooks";
import type { ApiRuntimeConfig, DefaultClerkOrganizationConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG } from "../../../config/api-config.provider";

export const CLERK_WEBHOOK_VERIFIER = Symbol("CLERK_WEBHOOK_VERIFIER");
export const CLERK_ORGANIZATION_MEMBERSHIP_CLIENT = Symbol("CLERK_ORGANIZATION_MEMBERSHIP_CLIENT");

export interface ClerkWebhookDeliveryInput {
  readonly rawBody: Buffer | null;
  readonly headers: Record<string, string | string[] | undefined>;
}

export interface ClerkWebhookReceipt {
  readonly status: "accepted";
  readonly eventName: string;
  readonly userId: string | null;
  readonly organizationId: string | null;
  readonly membershipStatus: "already_member" | "created" | "skipped";
  readonly ignored: boolean;
  readonly reason: string | null;
}

export interface ClerkWebhookVerifier {
  verify(input: {
    readonly rawBody: Buffer;
    readonly headers: Record<string, string | string[] | undefined>;
    readonly signingSecret: string;
  }): Promise<WebhookEvent>;
}

export interface ClerkOrganizationMembershipClient {
  ensureMembership(input: {
    readonly organization: DefaultClerkOrganizationConfig;
    readonly userId: string;
  }): Promise<"already_member" | "created">;
}

@Injectable()
export class ClerkBackendWebhookVerifier implements ClerkWebhookVerifier {
  async verify(input: {
    readonly rawBody: Buffer;
    readonly headers: Record<string, string | string[] | undefined>;
    readonly signingSecret: string;
  }): Promise<WebhookEvent> {
    const headers = new Headers();

    for (const [name, value] of Object.entries(input.headers)) {
      const first = Array.isArray(value) ? value[0] : value;

      if (first !== undefined) {
        headers.set(name, first);
      }
    }

    return verifyWebhook(
      new Request("https://firmcode.local/webhooks/clerk", {
        method: "POST",
        headers,
        body: new Uint8Array(input.rawBody)
      }),
      { signingSecret: input.signingSecret }
    );
  }
}

@Injectable()
export class ClerkBackendOrganizationMembershipClient implements ClerkOrganizationMembershipClient {
  private readonly clerk: ClerkClient;

  constructor(@Inject(API_RUNTIME_CONFIG) config: ApiRuntimeConfig) {
    this.clerk = createClerkClient({ secretKey: config.clerk.secretKey });
  }

  async ensureMembership(input: {
    readonly organization: DefaultClerkOrganizationConfig;
    readonly userId: string;
  }): Promise<"already_member" | "created"> {
    const existing = await this.findMembership(input);

    if (existing) {
      return "already_member";
    }

    try {
      await this.clerk.organizations.createOrganizationMembership({
        organizationId: input.organization.id,
        userId: input.userId,
        role: input.organization.role
      });

      return "created";
    } catch (error) {
      if (await this.findMembership(input)) {
        return "already_member";
      }

      throw error;
    }
  }

  private async findMembership(input: {
    readonly organization: DefaultClerkOrganizationConfig;
    readonly userId: string;
  }): Promise<boolean> {
    const memberships = await this.clerk.organizations.getOrganizationMembershipList({
      organizationId: input.organization.id,
      userId: [input.userId],
      limit: 1
    });

    return memberships.data.length > 0;
  }
}

@Injectable()
export class ClerkWebhookService {
  constructor(
    @Inject(API_RUNTIME_CONFIG) private readonly config: ApiRuntimeConfig,
    @Inject(CLERK_WEBHOOK_VERIFIER) private readonly verifier: ClerkWebhookVerifier,
    @Inject(CLERK_ORGANIZATION_MEMBERSHIP_CLIENT) private readonly membershipClient: ClerkOrganizationMembershipClient
  ) {}

  async acceptDelivery(input: ClerkWebhookDeliveryInput): Promise<ClerkWebhookReceipt> {
    if (input.rawBody === null) {
      throw new BadRequestException("Clerk webhook raw body is required");
    }

    if (this.config.clerk.webhookSecret === null) {
      throw new UnauthorizedException("CLERK_WEBHOOK_SECRET is required to accept Clerk webhooks");
    }

    const event = await this.verifier.verify({
      rawBody: input.rawBody,
      headers: input.headers,
      signingSecret: this.config.clerk.webhookSecret
    });

    if (event.type !== "user.created") {
      return {
        status: "accepted",
        eventName: event.type,
        userId: null,
        organizationId: null,
        membershipStatus: "skipped",
        ignored: true,
        reason: "unsupported_event"
      };
    }

    const membershipStatus = await this.membershipClient.ensureMembership({
      organization: this.config.clerk.defaultOrganization,
      userId: event.data.id
    });

    return {
      status: "accepted",
      eventName: event.type,
      userId: event.data.id,
      organizationId: this.config.clerk.defaultOrganization.id,
      membershipStatus,
      ignored: false,
      reason: null
    };
  }
}
