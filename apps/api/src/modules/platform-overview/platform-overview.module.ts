import { Module } from "@nestjs/common";
import { Pool } from "pg";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../config/api-config.provider";
import { PlatformOverviewController } from "./platform-overview.controller";
import { PlatformOverviewService } from "./platform-overview.service";
import {
  EmptyPlatformOverviewStore,
  PLATFORM_OVERVIEW_STORE,
  PostgresPlatformOverviewStore
} from "./platform-overview.store";

@Module({
  controllers: [PlatformOverviewController],
  providers: [
    apiRuntimeConfigProvider,
    PlatformOverviewService,
    {
      provide: PLATFORM_OVERVIEW_STORE,
      inject: [API_RUNTIME_CONFIG],
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new EmptyPlatformOverviewStore();
        }

        return new PostgresPlatformOverviewStore(
          new Pool({
            connectionString: config.database.url,
            ssl: config.database.ssl ? { rejectUnauthorized: false } : false
          })
        );
      }
    }
  ]
})
export class PlatformOverviewModule { }
