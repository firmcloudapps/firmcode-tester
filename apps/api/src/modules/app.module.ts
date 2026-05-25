import { Module } from "@nestjs/common";
import { BillingModule } from "./billing/billing.module";
import { CiFailuresModule } from "./ci-failures/ci-failures.module";
import { CodebaseScansModule } from "./codebase-scans/codebase-scans.module";
import { GitHubDashboardModule } from "./github/github.module";
import { HealthModule } from "./health/health.module";
import { PullRequestsModule } from "./pull-requests/pull-requests.module";
import { RepositoriesModule } from "./repositories/repositories.module";
import { ReviewRunsModule } from "./review-runs/review-runs.module";
import { RulesModule } from "./rules/rules.module";
import { SettingsModule } from "./settings/settings.module";
import { GitHubWebhookModule } from "./webhooks/github/github-webhook.module";

@Module({
  imports: [
    HealthModule,
    GitHubWebhookModule,
    CodebaseScansModule,
    GitHubDashboardModule,
    CiFailuresModule,
    PullRequestsModule,
    RepositoriesModule,
    ReviewRunsModule,
    RulesModule,
    SettingsModule,
    BillingModule
  ]
})
export class AppModule {}
