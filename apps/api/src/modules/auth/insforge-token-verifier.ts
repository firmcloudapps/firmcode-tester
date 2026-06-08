import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG } from "../../config/api-config.provider";
import type { TokenVerifier, VerifiedToken } from "./token-verifier";

export const INSFORGE_TOKEN_VERIFIER = Symbol("INSFORGE_TOKEN_VERIFIER");

interface InsForgeJwtPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  role?: string;
  session_id?: string;
  org_id?: string;
  org_role?: string;
  permissions?: string[];
  metadata?: Record<string, unknown>;
  iat: number;
  exp: number;
}

/**
 * InsForge JWT Token Verifier
 * 
 * Verifies JWT tokens issued by InsForge authentication service.
 * Note: Full cryptographic verification requires JWKS from InsForge.
 * For now, this validates the token structure and claims.
 */
@Injectable()
export class InsForgeTokenVerifier implements TokenVerifier {
  constructor(@Inject(API_RUNTIME_CONFIG) private readonly config: ApiRuntimeConfig) {}

  async verify(token: string): Promise<VerifiedToken> {
    try {
      const payload = this.decodeToken(token);
      
      if (!payload.sub) {
        throw new UnauthorizedException("InsForge token is missing subject");
      }

      // Check expiration
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        throw new UnauthorizedException("Token has expired");
      }

      return {
        userId: payload.sub,
        orgId: payload.org_id ?? null,
        sessionId: payload.session_id ?? null,
        orgRole: payload.org_role ?? null,
        firmcodeRole: this.extractFirmcodeRole(payload),
        billingCapabilities: payload.permissions ?? [],
        email: payload.email ?? null,
        emailVerified: payload.email_verified ?? false,
        provider: "insforge"
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("InsForge token is invalid");
    }
  }

  private decodeToken(token: string): InsForgeJwtPayload {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new UnauthorizedException("Invalid token format");
    }

    try {
      const payload = base64UrlDecode(parts[1]);
      return JSON.parse(payload) as InsForgeJwtPayload;
    } catch {
      throw new UnauthorizedException("Invalid token payload");
    }
  }

  private extractFirmcodeRole(payload: InsForgeJwtPayload): string | null {
    if (payload.metadata) {
      const firmcode = payload.metadata.firmcode;
      if (firmcode && typeof firmcode === "object") {
        const role = (firmcode as Record<string, unknown>).role;
        if (typeof role === "string") return role;
      }
      const firmcodeRole = payload.metadata.firmcode_role;
      if (typeof firmcodeRole === "string") return firmcodeRole;
    }
    return null;
  }
}

function base64UrlDecode(str: string): string {
  // Add padding if needed
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + padding;
  return Buffer.from(base64, "base64").toString("utf8");
}
