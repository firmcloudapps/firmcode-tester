import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { verifyToken } from "@clerk/backend";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG } from "../../config/api-config.provider";

export const CLERK_TOKEN_VERIFIER = Symbol("CLERK_TOKEN_VERIFIER");

export interface VerifiedClerkToken {
  readonly clerkUserId: string;
  readonly clerkOrgId: string | null;
  readonly sessionId: string | null;
  readonly orgRole: string | null;
  readonly billingCapabilities: readonly string[];
}

export interface ClerkTokenVerifier {
  verify(token: string): Promise<VerifiedClerkToken>;
}

@Injectable()
export class ClerkBackendTokenVerifier implements ClerkTokenVerifier {
  constructor(@Inject(API_RUNTIME_CONFIG) private readonly config: ApiRuntimeConfig) {}

  async verify(token: string): Promise<VerifiedClerkToken> {
    try {
      const payload = await verifyToken(token, {
        secretKey: this.config.clerk.secretKey,
        audience: this.config.clerk.jwtAudience ?? undefined
      });
      const clerkUserId = typeof payload.sub === "string" ? payload.sub : null;

      if (clerkUserId === null) {
        throw new UnauthorizedException("Clerk token is missing a subject");
      }

      return {
        clerkUserId,
        clerkOrgId: readStringClaim(payload, "org_id") ?? readV2OrgId(payload),
        sessionId: readStringClaim(payload, "sid"),
        orgRole: readStringClaim(payload, "org_role") ?? readV2OrgRole(payload),
        billingCapabilities: readBillingCapabilities(payload)
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Clerk token is invalid");
    }
  }
}

function readStringClaim(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value !== "" ? value : null;
}

function readV2OrgId(payload: Record<string, unknown>): string | null {
  const organization = payload.o;
  return organization !== null && typeof organization === "object" && "id" in organization
    ? readStringClaim(organization as Record<string, unknown>, "id")
    : null;
}

function readV2OrgRole(payload: Record<string, unknown>): string | null {
  const organization = payload.o;
  return organization !== null && typeof organization === "object" && "rol" in organization
    ? readStringClaim(organization as Record<string, unknown>, "rol")
    : null;
}

function readBillingCapabilities(payload: Record<string, unknown>): readonly string[] {
  const values = [payload.org_permissions, payload.permissions, payload.per].flatMap((value) =>
    Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\s]+/) : []
  );

  return values.filter((value): value is string => typeof value === "string" && value !== "");
}
