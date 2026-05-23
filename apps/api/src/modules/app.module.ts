import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { ReviewRunsModule } from "./review-runs/review-runs.module";
import { GitHubWebhookModule } from "./webhooks/github/github-webhook.module";

@Module({
  imports: [HealthModule, GitHubWebhookModule, ReviewRunsModule]
})
export class AppModule {}
