import { UnauthorizedException } from "@nestjs/common";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { InsForgeTokenVerifier } from "../src/modules/auth/insforge-token-verifier";

describe("InsForgeTokenVerifier", () => {
  it("verifies tokens through InsForge current-session lookup", async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      user: {
        id: "usr_insforge_1",
        email: "kelly@example.com",
        emailVerified: true,
        metadata: {
          org_id: "org_firmcode",
          org_role: "org:admin",
          firmcode_role: "admin"
        }
      }
    }));
    const verifier = new InsForgeTokenVerifier(testConfig, fetcher as typeof fetch);

    await expect(verifier.verify("session-token")).resolves.toEqual({
      userId: "usr_insforge_1",
      orgId: "org_firmcode",
      sessionId: null,
      orgRole: "org:admin",
      firmcodeRole: null,
      billingCapabilities: [],
      email: "kelly@example.com",
      emailVerified: true,
      provider: "insforge"
    });

    expect(fetcher).toHaveBeenCalledWith(new URL("https://insforge.test/api/auth/sessions/current"), {
      headers: {
        authorization: "Bearer session-token"
      }
    });
  });

  it("rejects invalid or userless InsForge sessions", async () => {
    const invalidVerifier = new InsForgeTokenVerifier(
      testConfig,
      vi.fn(async () => jsonResponse({ message: "Unauthorized" }, 401)) as typeof fetch
    );
    const userlessVerifier = new InsForgeTokenVerifier(
      testConfig,
      vi.fn(async () => jsonResponse({ user: null })) as typeof fetch
    );

    await expect(invalidVerifier.verify("bad-token")).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(userlessVerifier.verify("empty-token")).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

const testConfig = {
  auth: {
    provider: "insforge",
    insforge: {
      baseUrl: "https://insforge.test"
    },
    defaultWorkspace: {
      id: "",
      name: "Firmcode AI"
    }
  }
} as ApiRuntimeConfig;
