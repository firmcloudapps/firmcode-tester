import { Module } from "@nestjs/common";
import { Pool } from "pg";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../config/api-config.provider";
import {
  GitHubApiAccountClient,
  GitHubAppInstallationSyncClient,
  NoopGitHubAccountClient,
  NoopGitHubInstallationSyncClient
} from "../../infrastructure/github/github-app-sync-client";
import {
  DASHBOARD_AUTH_STORE,
  EmptyDashboardAuthStore,
  PostgresDashboardAuthStore
} from "../review-runs/dashboard-auth.store";
import { GitHubDashboardController } from "./github.controller";
import { GitHubDashboardService } from "./github.service";
import { EmptyGitHubDashboardStore, GITHUB_DASHBOARD_STORE, PostgresGitHubDashboardStore } from "./github.store";
import { GITHUB_ACCOUNT_CLIENT, GITHUB_INSTALLATION_SYNC_CLIENT } from "./github.tokens";

@Module({
  controllers: [GitHubDashboardController],
  providers: [
    apiRuntimeConfigProvider,
    {
      provide: GITHUB_DASHBOARD_STORE,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new EmptyGitHubDashboardStore();
        }

        return new PostgresGitHubDashboardStore(
          new Pool({
            connectionString: config.database.url,
            ssl: config.database.ssl ? { rejectUnauthorized: false } : false
          })
        );
      },
      inject: [API_RUNTIME_CONFIG]
    },
    {
      provide: DASHBOARD_AUTH_STORE,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new EmptyDashboardAuthStore();
        }

        return new PostgresDashboardAuthStore(
          new Pool({
            connectionString: config.database.url,
            ssl: config.database.ssl ? { rejectUnauthorized: false } : false
          })
        );
      },
      inject: [API_RUNTIME_CONFIG]
    },
    {
      provide: GITHUB_ACCOUNT_CLIENT,
      useFactory: (config: ApiRuntimeConfig) =>
        config.github === null ? new NoopGitHubAccountClient() : new GitHubApiAccountClient(config.github),
      inject: [API_RUNTIME_CONFIG]
    },
    {
      provide: GITHUB_INSTALLATION_SYNC_CLIENT,
      useFactory: (config: ApiRuntimeConfig) =>
        config.github === null ? new NoopGitHubInstallationSyncClient() : new GitHubAppInstallationSyncClient(config.github),
      inject: [API_RUNTIME_CONFIG]
    },
    GitHubDashboardService
  ]
})
export class GitHubDashboardModule {}
