import { Body, Controller, Headers, HttpCode, Inject, Post } from "@nestjs/common";
import { GitHubWebhookService, type GitHubWebhookReceipt } from "./github-webhook.service";

@Controller("webhooks")
export class GitHubWebhookController {
  constructor(@Inject(GitHubWebhookService) private readonly webhookService: GitHubWebhookService) {}

  @Post("github")
  @HttpCode(202)
  acceptGitHubWebhook(
    @Body() body: unknown,
    @Headers("x-hub-signature-256") signature: string | string[] | undefined,
    @Headers("x-github-event") eventName: string | string[] | undefined,
    @Headers("x-github-delivery") deliveryId: string | string[] | undefined
  ): Promise<GitHubWebhookReceipt> {
    return this.webhookService.acceptDelivery({
      rawBody: Buffer.isBuffer(body) ? body : null,
      signature,
      eventName,
      deliveryId
    });
  }
}
