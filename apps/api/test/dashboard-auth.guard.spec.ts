import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import type { DashboardAuthenticatedRequest } from "../src/modules/auth/dashboard-auth.context";
import { DashboardAuthGuard } from "../src/modules/auth/dashboard-auth.guard";
import type { TokenVerifier, VerifiedToken } from "../src/modules/auth/token-verifier";
import type {
  DashboardWorkspaceResolver,
  ResolvedDashboardWorkspace
} from "../src/modules/auth/workspace-resolver";

describe("DashboardAuthGuard", () => {
  it("rejects missing bearer tokens", async () => {
    const guard = createGuard();

    await expect(guard.canActivate(createHttpContext({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects malformed authorization headers", async () => {
    const guard = createGuard();

    await expect(guard.canActivate(createHttpContext({ authorization: "Basic abc" }))).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    await expect(guard.canActivate(createHttpContext({ authorization: "Bearer" }))).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("rejects invalid bearer tokens", async () => {
    const guard = createGuard({
      verifier: {
        async verify() {
          throw new UnauthorizedException("invalid");
        }
      }
    });

    await expect(guard.canActivate(createHttpContext({ authorization: "Bearer invalid" }))).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("accepts valid tokens when the provider omits a session id", async () => {
    const request = createRequest({ authorization: "Bearer sessionless" });
    const guard = createGuard({
      verifier: {
        async verify() {
          return {
            userId: "user_sessionless",
            orgId: null,
            sessionId: null,
            orgRole: null,
            firmcodeRole: null,
            billingCapabilities: [],
            provider: "insforge"
          };
        }
      }
    });

    await expect(guard.canActivate(createHttpContext(request.headers, request))).resolves.toBe(true);
    expect(request.dashboardAuth?.sessionId).toBeNull();
  });

  it("rejects expired bearer tokens", async () => {
    const guard = createGuard({
      verifier: {
        async verify() {
          throw new UnauthorizedException("expired");
        }
      }
    });

    await expect(guard.canActivate(createHttpContext({ authorization: "Bearer expired" }))).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("rejects tokens with the wrong audience", async () => {
    const guard = createGuard({
      verifier: {
        async verify() {
          throw new UnauthorizedException("wrong audience");
        }
      }
    });

    await expect(
      guard.canActivate(createHttpContext({ authorization: "Bearer wrong-audience" }))
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("resolves a valid personal workspace token into trusted request context", async () => {
    const request = createRequest({ authorization: "Bearer personal-token" });
    const guard = createGuard();

    await expect(guard.canActivate(createHttpContext(request.headers, request))).resolves.toBe(true);

    expect(request.headers["x-firmcode-user-id"]).toBeUndefined();
    expect(request.headers["x-firmcode-workspace-id"]).toBeUndefined();
    expect(request).toMatchObject({
      dashboardAuth: {
        userId: "user_personal",
        orgId: null,
        workspaceId: "00000000-0000-4000-8000-000000000101",
        role: "developer",
        capabilities: expect.arrayContaining(["retry_review_run", "trigger_codebase_scan", "manage_codebase_scan_findings"])
      }
    });
  });

  it("resolves a valid organization token into workspace membership and role", async () => {
    const request = createRequest({ authorization: "Bearer organization-token" });
    const guard = createGuard({
      verifier: {
        async verify() {
          return {
            userId: "user_admin",
            orgId: "org_firmcode",
            sessionId: "sess_org",
            orgRole: "org:admin",
            firmcodeRole: null,
            billingCapabilities: ["org:billing:manage"],
            provider: "insforge"
          };
        }
      }
    });

    await expect(guard.canActivate(createHttpContext(request.headers, request))).resolves.toBe(true);

    expect(request.headers["x-firmcode-user-id"]).toBeUndefined();
    expect(request.headers["x-firmcode-workspace-id"]).toBeUndefined();
    expect(request.headers["x-firmcode-billing-capability"]).toBeUndefined();
    expect(request).toMatchObject({
      dashboardAuth: {
        userId: "user_admin",
        orgId: "org_firmcode",
        workspaceId: "00000000-0000-4000-8000-000000000202",
        role: "admin",
        capabilities: expect.arrayContaining(["manage_billing", "manage_github_installations"])
      }
    });
  });

  it("rejects spoofed user headers before controller code can trust them", async () => {
    const guard = createGuard();

    await expect(
      guard.canActivate(
        createHttpContext({
          authorization: "Bearer personal-token",
          "x-firmcode-user-id": "user_attacker"
        })
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects selected workspaces when the verified user is not a member", async () => {
    const guard = createGuard({
      resolver: {
        async resolve() {
          throw new ForbiddenException("Workspace membership is required");
        }
      }
    });

    await expect(
      guard.canActivate(
        createHttpContext({
          authorization: "Bearer personal-token",
          "x-firmcode-workspace-id": "00000000-0000-4000-8000-000000000999"
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects authenticated requests when no workspace can be resolved", async () => {
    const guard = createGuard({
      resolver: {
        async resolve() {
          throw new ForbiddenException("Workspace membership is required");
        }
      }
    });

    await expect(guard.canActivate(createHttpContext({ authorization: "Bearer personal-token" }))).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("uses the verified provider subject even when a workspace selector header is present", async () => {
    const request = createRequest({
      authorization: "Bearer personal-token",
      "x-firmcode-workspace-id": "00000000-0000-4000-8000-000000000404"
    });
    const resolverCalls: Array<{ userId: string; selectedWorkspaceId: string | null }> = [];
    const guard = createGuard({
      verifier: {
        async verify() {
          return {
            userId: "user_verified",
            orgId: null,
            sessionId: "sess_verified",
            orgRole: null,
            firmcodeRole: null,
            billingCapabilities: [],
            provider: "insforge"
          };
        }
      },
      resolver: {
        async resolve(input) {
          resolverCalls.push({
            userId: input.token.userId,
            selectedWorkspaceId: input.selectedWorkspaceId
          });

          return {
            workspaceId: input.selectedWorkspaceId ?? "00000000-0000-4000-8000-000000000101",
            userId: input.token.userId,
            orgId: null,
            sessionId: input.token.sessionId,
            role: "developer",
            billingCapabilities: []
          };
        }
      }
    });

    await expect(guard.canActivate(createHttpContext(request.headers, request))).resolves.toBe(true);

    expect(resolverCalls).toEqual([
      {
        userId: "user_verified",
        selectedWorkspaceId: "00000000-0000-4000-8000-000000000404"
      }
    ]);
    expect(request.dashboardAuth).toMatchObject({
      userId: "user_verified",
      workspaceId: "00000000-0000-4000-8000-000000000404"
    });
  });
});

function createGuard(overrides: {
  verifier?: TokenVerifier;
  resolver?: DashboardWorkspaceResolver;
} = {}): DashboardAuthGuard {
  return new DashboardAuthGuard(testConfig, overrides.verifier ?? new FakeVerifier(), overrides.resolver ?? new FakeWorkspaceResolver());
}

class FakeVerifier implements TokenVerifier {
  async verify(): Promise<VerifiedToken> {
    return {
      userId: "user_personal",
      orgId: null,
      sessionId: "sess_personal",
      orgRole: null,
      firmcodeRole: null,
      billingCapabilities: [],
      provider: "insforge"
    };
  }
}

class FakeWorkspaceResolver implements DashboardWorkspaceResolver {
  async resolve(input: { token: VerifiedToken; selectedWorkspaceId: string | null }): Promise<ResolvedDashboardWorkspace> {
    const isOrganization = input.token.orgId !== null;

    return {
      workspaceId: input.selectedWorkspaceId ?? (isOrganization ? "00000000-0000-4000-8000-000000000202" : "00000000-0000-4000-8000-000000000101"),
      userId: input.token.userId,
      orgId: input.token.orgId,
      sessionId: input.token.sessionId,
      role: isOrganization ? "admin" : "developer",
      billingCapabilities: input.token.billingCapabilities
    };
  }
}

function createHttpContext(
  headers: Record<string, string | string[] | undefined>,
  request: DashboardAuthenticatedRequest | Record<string, unknown> = { headers }
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}

function createRequest(headers: Record<string, string | string[] | undefined>): DashboardAuthenticatedRequest {
  return { headers };
}

const testConfig = {} as ApiRuntimeConfig;
