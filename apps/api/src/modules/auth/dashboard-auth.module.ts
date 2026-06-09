import { Global, Module } from "@nestjs/common";
import { Pool } from "pg";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../config/api-config.provider";
import { DashboardAuthController } from "./dashboard-auth.controller";
import { DashboardAuthGuard } from "./dashboard-auth.guard";
import { InsForgeTokenVerifier } from "./insforge-token-verifier";
import { TOKEN_VERIFIER } from "./token-verifier";
import {
  DASHBOARD_WORKSPACE_RESOLVER,
  EmptyDashboardWorkspaceResolver,
  PostgresDashboardWorkspaceResolver
} from "./workspace-resolver";

@Global()
@Module({
  controllers: [DashboardAuthController],
  providers: [
    apiRuntimeConfigProvider,
    {
      provide: TOKEN_VERIFIER,
      useFactory: (config: ApiRuntimeConfig) => new InsForgeTokenVerifier(config),
      inject: [API_RUNTIME_CONFIG]
    },
    {
      provide: DASHBOARD_WORKSPACE_RESOLVER,
      useFactory: (config: ApiRuntimeConfig) => {
        if (config.nodeEnv === "test") {
          return new EmptyDashboardWorkspaceResolver();
        }

        return new PostgresDashboardWorkspaceResolver(
          new Pool({
            connectionString: config.database.url,
            ssl: config.database.ssl ? { rejectUnauthorized: false } : false
          }),
          undefined,
          config.auth?.defaultWorkspace ?? null
        );
      },
      inject: [API_RUNTIME_CONFIG]
    },
    DashboardAuthGuard
  ],
  exports: [TOKEN_VERIFIER, DASHBOARD_WORKSPACE_RESOLVER, DashboardAuthGuard]
})
export class DashboardAuthModule { }
