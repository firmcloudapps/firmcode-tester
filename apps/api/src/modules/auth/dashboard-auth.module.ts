import { Global, Module } from "@nestjs/common";
import { Pool } from "pg";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG, apiRuntimeConfigProvider } from "../../config/api-config.provider";
import { CLERK_TOKEN_VERIFIER, ClerkBackendTokenVerifier } from "./clerk-token-verifier";
import { DashboardAuthGuard } from "./dashboard-auth.guard";
import {
  DASHBOARD_WORKSPACE_RESOLVER,
  EmptyDashboardWorkspaceResolver,
  PostgresDashboardWorkspaceResolver
} from "./workspace-resolver";

@Global()
@Module({
  providers: [
    apiRuntimeConfigProvider,
    {
      provide: CLERK_TOKEN_VERIFIER,
      useClass: ClerkBackendTokenVerifier
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
          })
        );
      },
      inject: [API_RUNTIME_CONFIG]
    },
    DashboardAuthGuard
  ],
  exports: [CLERK_TOKEN_VERIFIER, DASHBOARD_WORKSPACE_RESOLVER, DashboardAuthGuard]
})
export class DashboardAuthModule {}
