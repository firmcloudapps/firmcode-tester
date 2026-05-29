import { Body, Controller, Headers, HttpCode, Inject, Post } from "@nestjs/common";
import { ClerkWebhookService, type ClerkWebhookReceipt } from "./clerk-webhook.service";

@Controller("webhooks")
export class ClerkWebhookController {
  constructor(@Inject(ClerkWebhookService) private readonly webhookService: ClerkWebhookService) {}

  @Post("clerk")
  @HttpCode(202)
  acceptClerkWebhook(
    @Body() body: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>
  ): Promise<ClerkWebhookReceipt> {
    return this.webhookService.acceptDelivery({
      rawBody: Buffer.isBuffer(body) ? body : null,
      headers
    });
  }
}
