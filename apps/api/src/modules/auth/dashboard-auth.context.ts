import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { DashboardRole } from "../review-runs/dashboard-auth.store";

export interface DashboardRequestContext {
  readonly clerkUserId: string;
  readonly clerkOrgId: string | null;
  readonly sessionId: string | null;
  readonly workspaceId: string;
  readonly role: DashboardRole;
  readonly capabilities: readonly string[];
}

export interface DashboardAuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  dashboardAuth?: DashboardRequestContext;
}

export const DashboardAuth = createParamDecorator((_data: unknown, context: ExecutionContext): DashboardRequestContext => {
  const request = context.switchToHttp().getRequest<DashboardAuthenticatedRequest>();

  if (request.dashboardAuth === undefined) {
    throw new Error("Dashboard auth context is not available");
  }

  return request.dashboardAuth;
});
