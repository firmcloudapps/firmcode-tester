import { Module } from "@nestjs/common";
import { BillingModule } from "./billing/billing.module";
import { HealthModule } from "./health/health.module";
import { RepositoriesModule } from "./repositories/repositories.module";
import { ReviewRunsModule } from "./review-runs/review-runs.module";
import { SettingsModule } from "./settings/settings.module";
import { GitHubWebhookModule } from "./webhooks/github/github-webhook.module";

@Module({
  imports: [HealthModule, GitHubWebhookModule, RepositoriesModule, ReviewRunsModule, SettingsModule, BillingModule]
})
export class AppModule {}
