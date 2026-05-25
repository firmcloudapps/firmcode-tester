import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { DashboardAuthGuard } from "../src/modules/auth/dashboard-auth.guard";
import type { ClerkTokenVerifier, VerifiedClerkToken } from "../src/modules/auth/clerk-token-verifier";
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
        clerkUserId: "user_personal",
        clerkOrgId: null,
        workspaceId: "00000000-0000-4000-8000-000000000101",
        role: "developer",
        capabilities: expect.arrayContaining(["retry_review_run", "trigger_codebase_scan"])
      }
    });
  });

  it("resolves a valid organization token into workspace membership and role", async () => {
    const request = createRequest({ authorization: "Bearer organization-token" });
    const guard = createGuard({
      verifier: {
        async verify() {
          return {
            clerkUserId: "user_admin",
            clerkOrgId: "org_firmcode",
            sessionId: "sess_org",
            orgRole: "org:admin",
            firmcodeRole: null,
            billingCapabilities: ["org:billing:manage"]
          };
        }
      }
    });

    await expect(guard.canActivate(createHttpContext(request.headers, request))).resolves.toBe(true);

    expect(request.headers["x-firmcode-user-id"]).toBeUndefined();
    expect(request.headers["x-firmcode-workspace-id"]).toBeUndefined();
    expect(request.headers["x-firmcode-clerk-billing-capability"]).toBeUndefined();
    expect(request).toMatchObject({
      dashboardAuth: {
        clerkUserId: "user_admin",
        clerkOrgId: "org_firmcode",
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
});

function createGuard(overrides: {
  verifier?: ClerkTokenVerifier;
  resolver?: DashboardWorkspaceResolver;
} = {}): DashboardAuthGuard {
  return new DashboardAuthGuard(overrides.verifier ?? new FakeVerifier(), overrides.resolver ?? new FakeWorkspaceResolver());
}

class FakeVerifier implements ClerkTokenVerifier {
  async verify(): Promise<VerifiedClerkToken> {
    return {
      clerkUserId: "user_personal",
      clerkOrgId: null,
      sessionId: "sess_personal",
      orgRole: null,
      firmcodeRole: null,
      billingCapabilities: []
    };
  }
}

class FakeWorkspaceResolver implements DashboardWorkspaceResolver {
  async resolve(input: { token: VerifiedClerkToken; selectedWorkspaceId: string | null }): Promise<ResolvedDashboardWorkspace> {
    const isOrganization = input.token.clerkOrgId !== null;

    return {
      workspaceId: input.selectedWorkspaceId ?? (isOrganization ? "00000000-0000-4000-8000-000000000202" : "00000000-0000-4000-8000-000000000101"),
      clerkUserId: input.token.clerkUserId,
      clerkOrgId: input.token.clerkOrgId,
      sessionId: input.token.sessionId,
      role: isOrganization ? "admin" : "developer",
      billingCapabilities: input.token.billingCapabilities
    };
  }
}

function createHttpContext(headers: Record<string, string | string[] | undefined>, request: Record<string, unknown> = { headers }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}

function createRequest(headers: Record<string, string | string[] | undefined>): { headers: Record<string, string | string[] | undefined> } {
  return { headers };
}
