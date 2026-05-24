import { Module } from "@nestjs/common";
import { Pool } from "pg";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../config/api-config.provider";
import {
  DASHBOARD_AUTH_STORE,
  EmptyDashboardAuthStore,
  PostgresDashboardAuthStore
} from "../review-runs/dashboard-auth.store";
import { CiFailuresController } from "./ci-failures.controller";
import { CI_FAILURES_STORE, EmptyCiFailuresStore, PostgresCiFailuresStore } from "./ci-failures.store";

@Module({
  controllers: [CiFailuresController],
  providers: [
    apiRuntimeConfigProvider,
    {
      provide: CI_FAILURES_STORE,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new EmptyCiFailuresStore();
        }

        return new PostgresCiFailuresStore(
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
export class CiFailuresModule {}
