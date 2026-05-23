import { Module } from "@nestjs/common";
import { Pool } from "pg";
import { type ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../../config/api-config.provider";
import {
  GITHUB_PUSH_PR_RESOLVER,
  GitHubAppPushPullRequestResolver,
  NoopGitHubPushPullRequestResolver
} from "../../../infrastructure/github/github-push-pr-resolver";
import {
  GITHUB_PR_REVIEW_PUBLISHER,
  GitHubAppPullRequestReviewPublisher,
  NoopGitHubPullRequestReviewPublisher,
  PostgresPublishedCommentStore
} from "../../../infrastructure/github/github-pr-review-publisher";
import { ReviewQueueModule } from "../../queues/review-queue.module";
import { GitHubWebhookController } from "./github-webhook.controller";
import { GITHUB_WEBHOOK_SECRET, GitHubWebhookService } from "./github-webhook.service";
import { GITHUB_WEBHOOK_STORE, InMemoryGitHubWebhookStore } from "./github-webhook.store";
import { PostgresGitHubWebhookStore } from "./postgres-github-webhook.store";

@Module({
  imports: [ReviewQueueModule],
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
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new InMemoryGitHubWebhookStore();
        }

        return new PostgresGitHubWebhookStore(
          new Pool({
            connectionString: config.database.url,
            ssl: config.database.ssl ? { rejectUnauthorized: false } : false
          })
        );
      },
      inject: [API_RUNTIME_CONFIG]
    },
    {
      provide: GITHUB_PR_REVIEW_PUBLISHER,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new NoopGitHubPullRequestReviewPublisher();
        }

        const pool = new Pool({
          connectionString: config.database.url,
          ssl: config.database.ssl ? { rejectUnauthorized: false } : false
        });

        return GitHubAppPullRequestReviewPublisher.fromConfig(config, new PostgresPublishedCommentStore(pool));
      },
      inject: [API_RUNTIME_CONFIG]
    },
    {
      provide: GITHUB_PUSH_PR_RESOLVER,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new NoopGitHubPushPullRequestResolver();
        }

        return GitHubAppPushPullRequestResolver.fromConfig(config);
      },
      inject: [API_RUNTIME_CONFIG]
    },
    GitHubWebhookService
  ]
})
export class GitHubWebhookModule {}
