import { Module } from "@nestjs/common";
import { Pool } from "pg";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../config/api-config.provider";
import { DashboardAuthorizationService } from "./dashboard-authorization.service";
import { DASHBOARD_AUTH_STORE, EmptyDashboardAuthStore, PostgresDashboardAuthStore } from "./dashboard-auth.store";

@Module({
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
    DashboardAuthorizationService
  ],
  exports: [DASHBOARD_AUTH_STORE, DashboardAuthorizationService]
})
export class DashboardAuthModule {}
