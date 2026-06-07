import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG } from "../../config/api-config.provider";
import {
  deriveDashboardCapabilities,
  type DashboardAuthenticatedRequest,
  type DashboardRequestContext
} from "./dashboard-auth.context";
import {
  DASHBOARD_WORKSPACE_RESOLVER,
  type DashboardWorkspaceResolver
} from "./workspace-resolver";
import { TOKEN_VERIFIER, type TokenVerifier, type VerifiedToken } from "./token-verifier";

const WORKSPACE_HEADER = "x-firmcode-workspace-id";
const USER_HEADER = "x-firmcode-user-id";

@Injectable()
export class DashboardAuthGuard implements CanActivate {
  constructor(
    @Inject(API_RUNTIME_CONFIG) private readonly config: ApiRuntimeConfig,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    @Inject(DASHBOARD_WORKSPACE_RESOLVER) private readonly workspaceResolver: DashboardWorkspaceResolver
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<DashboardAuthenticatedRequest>();
    const headers = normalizeHeaders(request.headers);
    const spoofedUserHeader = readHeader(headers, USER_HEADER);

    if (spoofedUserHeader !== null) {
      throw new UnauthorizedException("Client-provided user identity headers are not accepted");
    }

    const token = readBearerToken(readHeader(headers, "authorization"));

    if (token === null) {
      throw new UnauthorizedException("Bearer token is required");
    }

    const verified = await this.verifier.verify(token);

    if (verified.sessionId === null) {
      throw new UnauthorizedException("Session is required");
    }

    const workspace = await this.workspaceResolver.resolve({
      token: verified,
      selectedWorkspaceId: readHeader(headers, WORKSPACE_HEADER)
    });

    const capabilities = deriveDashboardCapabilities(workspace.role, workspace.billingCapabilities);
    const requestContext: DashboardRequestContext = {
      userId: workspace.userId,
      orgId: workspace.orgId,
      sessionId: workspace.sessionId,
      workspaceId: workspace.workspaceId,
      role: workspace.role,
      capabilities,
      billingCapabilities: workspace.billingCapabilities,
      provider: verified.provider,
      // Deprecated fields for backward compatibility
      clerkUserId: workspace.userId,
      clerkOrgId: workspace.orgId,
      clerkCapabilities: workspace.billingCapabilities
    };

    request.dashboardAuth = requestContext;

    return true;
  }
}

function normalizeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string | string[] | undefined> {
  const normalized: Record<string, string | string[] | undefined> = {};

  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }

  return normalized;
}

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const value = headers[name.toLowerCase()];
  const candidate = Array.isArray(value) ? value[0] : value;

  return candidate === undefined || candidate === "" ? null : candidate;
}

function readBearerToken(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1] ?? null;
}
