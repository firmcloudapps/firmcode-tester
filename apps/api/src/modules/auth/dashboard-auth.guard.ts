import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import {
  CLERK_TOKEN_VERIFIER,
  type ClerkTokenVerifier
} from "./clerk-token-verifier";
import {
  deriveDashboardCapabilities,
  type DashboardAuthenticatedRequest,
  type DashboardRequestContext
} from "./dashboard-auth.context";
import {
  DASHBOARD_WORKSPACE_RESOLVER,
  type DashboardWorkspaceResolver
} from "./workspace-resolver";

const WORKSPACE_HEADER = "x-firmcode-workspace-id";
const USER_HEADER = "x-firmcode-user-id";

@Injectable()
export class DashboardAuthGuard implements CanActivate {
  constructor(
    @Inject(CLERK_TOKEN_VERIFIER) private readonly verifier: ClerkTokenVerifier,
    @Inject(DASHBOARD_WORKSPACE_RESOLVER) private readonly workspaceResolver: DashboardWorkspaceResolver
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<DashboardAuthenticatedRequest>();
    const headers = normalizeHeaders(request.headers);
    const spoofedUserHeader = readHeader(headers, USER_HEADER);

    if (spoofedUserHeader !== null) {
      throw new UnauthorizedException("Client-provided user identity headers are not accepted");
    }

    const token = readBearerToken(readHeader(headers, "authorization"));

    if (token === null) {
      throw new UnauthorizedException("Clerk bearer token is required");
    }

    const verified = await this.verifier.verify(token);
    const workspace = await this.workspaceResolver.resolve({
      token: verified,
      selectedWorkspaceId: readHeader(headers, WORKSPACE_HEADER)
    });
    const requestContext: DashboardRequestContext = {
      clerkUserId: workspace.clerkUserId,
      clerkOrgId: workspace.clerkOrgId,
      sessionId: workspace.sessionId,
      workspaceId: workspace.workspaceId,
      role: workspace.role,
      capabilities: deriveDashboardCapabilities(workspace.role, workspace.billingCapabilities),
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
