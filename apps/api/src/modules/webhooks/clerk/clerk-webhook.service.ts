import { BadRequestException, Injectable } from "@nestjs/common";

export interface ClerkWebhookDeliveryInput {
  readonly rawBody: Buffer | null;
  readonly headers: Record<string, string | string[] | undefined>;
}

export interface ClerkWebhookReceipt {
  readonly status: "accepted";
  readonly eventName: string;
  readonly userId: string | null;
  readonly organizationId: string | null;
  readonly membershipStatus: "already_member" | "created" | "skipped" | "failed";
  readonly ignored: boolean;
  readonly reason: string | null;
}

@Injectable()
export class ClerkWebhookService {
  async acceptDelivery(input: ClerkWebhookDeliveryInput): Promise<ClerkWebhookReceipt> {
    if (input.rawBody === null) {
      throw new BadRequestException("Clerk webhook raw body is required");
    }
    return {
      status: "accepted",
      eventName: "clerk.disabled",
      userId: null,
      organizationId: null,
      membershipStatus: "skipped",
      ignored: true,
      reason: "clerk_removed"
    };
  }
}
