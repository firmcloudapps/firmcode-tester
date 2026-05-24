import { Module } from "@nestjs/common";
import { Pool } from "pg";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../config/api-config.provider";
import {
  DASHBOARD_AUTH_STORE,
  EmptyDashboardAuthStore,
  PostgresDashboardAuthStore
} from "../review-runs/dashboard-auth.store";
import { RulesController } from "./rules.controller";
import { RulesService } from "./rules.service";
import { EmptyRulesStore, PostgresRulesStore, RULES_STORE } from "./rules.store";

@Module({
  controllers: [RulesController],
  providers: [
    apiRuntimeConfigProvider,
    {
      provide: RULES_STORE,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new EmptyRulesStore();
        }

        return new PostgresRulesStore(
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
    RulesService
  ]
})
export class RulesModule {}
