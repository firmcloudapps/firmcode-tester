import { Module } from "@nestjs/common";
import { Pool } from "pg";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../config/api-config.provider";
import {
  DASHBOARD_AUTH_STORE,
  EmptyDashboardAuthStore,
  PostgresDashboardAuthStore
} from "../review-runs/dashboard-auth.store";
import { PullRequestsController } from "./pull-requests.controller";
import { EmptyPullRequestsStore, PostgresPullRequestsStore, PULL_REQUESTS_STORE } from "./pull-requests.store";

@Module({
  controllers: [PullRequestsController],
  providers: [
    apiRuntimeConfigProvider,
    {
      provide: PULL_REQUESTS_STORE,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new EmptyPullRequestsStore();
        }

        return new PostgresPullRequestsStore(
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
    }
  ]
})
export class PullRequestsModule {}
