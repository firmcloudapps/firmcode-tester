import { Module } from "@nestjs/common";
import { Pool } from "pg";
import { type ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../../config/api-config.provider";
import {
  GITHUB_PR_ACTIVITY_PUBLISHER,
  GitHubAppPullRequestActivityPublisher,
  NoopGitHubPullRequestActivityPublisher
} from "../../../infrastructure/github/github-pr-activity-publisher";
import { BullMqReviewQueueProducer, InMemoryReviewQueueProducer, REVIEW_QUEUE } from "../../queues/review-queue";
import { GitHubWebhookController } from "./github-webhook.controller";
import { GITHUB_WEBHOOK_SECRET, GitHubWebhookService } from "./github-webhook.service";
import { GITHUB_WEBHOOK_STORE, InMemoryGitHubWebhookStore } from "./github-webhook.store";
import { PostgresGitHubWebhookStore } from "./postgres-github-webhook.store";

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
      provide: REVIEW_QUEUE,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new InMemoryReviewQueueProducer();
        }

        return new BullMqReviewQueueProducer(config.queue.redisUrl);
      },
      inject: [API_RUNTIME_CONFIG]
    },
    {
      provide: GITHUB_PR_ACTIVITY_PUBLISHER,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new NoopGitHubPullRequestActivityPublisher();
        }

        return GitHubAppPullRequestActivityPublisher.fromConfig(config);
      },
      inject: [API_RUNTIME_CONFIG]
    },
    GitHubWebhookService
  ]
})
export class GitHubWebhookModule {}
