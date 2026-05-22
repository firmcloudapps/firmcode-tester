import { Module } from "@nestjs/common";
import { type ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../../config/api-config.provider";
import { GitHubWebhookController } from "./github-webhook.controller";
import { GITHUB_WEBHOOK_SECRET, GitHubWebhookService } from "./github-webhook.service";
import { GITHUB_WEBHOOK_STORE, InMemoryGitHubWebhookStore } from "./github-webhook.store";

@Module({
  controllers: [GitHubWebhookController],
  providers: [
    apiRuntimeConfigProvider,
    {
      provide: GITHUB_WEBHOOK_SECRET,
      useFactory: (config: ApiRuntimeConfig): string => {
        if (config.github === null) {
          throw new Error("GITHUB_WEBHOOK_SECRET is required to accept GitHub webhooks");
        }

        return config.github.webhookSecret;
      },
      inject: [API_RUNTIME_CONFIG]
    },
    {
      provide: GITHUB_WEBHOOK_STORE,
      useClass: InMemoryGitHubWebhookStore
    },
    GitHubWebhookService
  ]
})
export class GitHubWebhookModule {}
