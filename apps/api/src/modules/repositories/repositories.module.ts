import { Module } from "@nestjs/common";
import { Pool } from "pg";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../config/api-config.provider";
import { DashboardAuthModule } from "../auth/dashboard-auth.module";
import { RepositoriesController } from "./repositories.controller";
import { RepositoryConfigurationService } from "./repository-configuration.service";
import { EmptyRepositoriesStore, PostgresRepositoriesStore, REPOSITORIES_STORE } from "./repositories.store";

@Module({
  imports: [DashboardAuthModule],
  controllers: [RepositoriesController],
  providers: [
    apiRuntimeConfigProvider,
    {
      provide: REPOSITORIES_STORE,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new EmptyRepositoriesStore();
        }

        return new PostgresRepositoriesStore(
          new Pool({
            connectionString: config.database.url,
            ssl: config.database.ssl ? { rejectUnauthorized: false } : false
          })
        );
      },
      inject: [API_RUNTIME_CONFIG]
    },
    RepositoryConfigurationService
  ]
})
export class RepositoriesModule {}
