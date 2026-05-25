import { Module } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../config/api-config.provider";
import { ReviewQueueModule } from "../queues/review-queue.module";
import {
  DASHBOARD_AUTH_STORE,
  EmptyDashboardAuthStore,
  PostgresDashboardAuthStore
} from "../review-runs/dashboard-auth.store";
import {
  CODEBASE_SCAN_CORRELATION_ID_FACTORY,
  CODEBASE_SCAN_TARGET_STORE,
  CodebaseScanEnqueueService,
  EmptyCodebaseScanTargetStore,
  PostgresCodebaseScanTargetStore
} from "./codebase-scan-enqueue.service";
import { CodebaseScansController } from "./codebase-scans.controller";
import { CODEBASE_SCAN_STORE, EmptyCodebaseScanStore, PostgresCodebaseScanStore } from "./codebase-scan.store";

@Module({
  imports: [ReviewQueueModule],
  controllers: [CodebaseScansController],
  providers: [
    apiRuntimeConfigProvider,
    {
      provide: CODEBASE_SCAN_STORE,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new EmptyCodebaseScanStore();
        }

        return new PostgresCodebaseScanStore(
          new Pool({
            connectionString: config.database.url,
            ssl: config.database.ssl ? { rejectUnauthorized: false } : false
          })
        );
      },
      inject: [API_RUNTIME_CONFIG]
    },
    {
      provide: CODEBASE_SCAN_TARGET_STORE,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new EmptyCodebaseScanTargetStore();
        }

        return new PostgresCodebaseScanTargetStore(
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
      provide: CODEBASE_SCAN_CORRELATION_ID_FACTORY,
      useValue: randomUUID
    },
    CodebaseScanEnqueueService
  ],
  exports: [CODEBASE_SCAN_STORE, CODEBASE_SCAN_TARGET_STORE, CodebaseScanEnqueueService]
})
export class CodebaseScansModule {}
