import { Module } from "@nestjs/common";
import { Pool } from "pg";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../config/api-config.provider";
import { ReviewRunsController } from "./review-runs.controller";
import { EmptyReviewRunsStore, PostgresReviewRunsStore, REVIEW_RUNS_STORE } from "./review-runs.store";

@Module({
  controllers: [ReviewRunsController],
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
    }
  ]
})
export class ReviewRunsModule {}
