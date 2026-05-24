import { Module } from "@nestjs/common";
import { Pool } from "pg";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../config/api-config.provider";
import {
  DASHBOARD_AUTH_STORE,
  EmptyDashboardAuthStore,
  PostgresDashboardAuthStore
} from "../review-runs/dashboard-auth.store";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";

@Module({
  controllers: [BillingController],
  providers: [
    apiRuntimeConfigProvider,
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
    BillingService
  ]
})
export class BillingModule {}
