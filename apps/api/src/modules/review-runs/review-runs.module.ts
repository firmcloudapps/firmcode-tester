import { Module } from "@nestjs/common";
import { Pool } from "pg";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../config/api-config.provider";
import { DashboardAuthModule } from "../auth/dashboard-auth.module";
import { ReviewQueueModule } from "../queues/review-queue.module";
import { FindingsController } from "./findings.controller";
import { EmptyFindingsStore, FINDINGS_STORE, PostgresFindingsStore } from "./findings.store";
import { ReviewRunRetryService } from "./review-run-retry.service";
import { ReviewRunsController } from "./review-runs.controller";
import { EmptyReviewRunsStore, PostgresReviewRunsStore, REVIEW_RUNS_STORE } from "./review-runs.store";

@Module({
  imports: [DashboardAuthModule, ReviewQueueModule],
  controllers: [ReviewRunsController, FindingsController],
  providers: [
    apiRuntimeConfigProvider,
    {
      provide: REVIEW_RUNS_STORE,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new EmptyReviewRunsStore();
        }

        return new PostgresReviewRunsStore(
          new Pool({
            connectionString: config.database.url,
            ssl: config.database.ssl ? { rejectUnauthorized: false } : false
          })
        );
      },
      inject: [API_RUNTIME_CONFIG]
    },
    {
      provide: FINDINGS_STORE,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new EmptyFindingsStore();
        }

        return new PostgresFindingsStore(
          new Pool({
            connectionString: config.database.url,
            ssl: config.database.ssl ? { rejectUnauthorized: false } : false
          })
        );
      },
      inject: [API_RUNTIME_CONFIG]
    },
    ReviewRunRetryService
  ]
})
export class ReviewRunsModule {}
