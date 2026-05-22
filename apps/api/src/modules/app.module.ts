import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { GitHubWebhookModule } from "./webhooks/github/github-webhook.module";

@Module({
  imports: [HealthModule, GitHubWebhookModule]
})
export class AppModule {}
