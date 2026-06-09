import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { ApiRuntimeConfig } from "@firmcode/shared";
import { API_RUNTIME_CONFIG } from "../../config/api-config.provider";
import type { TokenVerifier, VerifiedToken } from "./token-verifier";

export const INSFORGE_TOKEN_VERIFIER = Symbol("INSFORGE_TOKEN_VERIFIER");

type Fetcher = typeof fetch;

interface InsForgeCurrentSessionResponse {
  readonly user?: InsForgeUser | null;
}

interface InsForgeUser {
  readonly id?: unknown;
  readonly email?: unknown;
  readonly emailVerified?: unknown;
  readonly metadata?: unknown;
  readonly profile?: unknown;
}

@Injectable()
export class InsForgeTokenVerifier implements TokenVerifier {
  constructor(
    @Inject(API_RUNTIME_CONFIG) private readonly config: ApiRuntimeConfig,
    private readonly fetcher: Fetcher = fetch
  ) {}

  async verify(token: string): Promise<VerifiedToken> {
    const authConfig = this.config.auth.insforge;

    if (authConfig === null) {
      throw new UnauthorizedException("InsForge auth is not configured");
    }

    try {
      const response = await this.fetcher(new URL("/api/auth/sessions/current", authConfig.baseUrl), {
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new UnauthorizedException("InsForge token is invalid");
      }

      const payload = (await response.json()) as InsForgeCurrentSessionResponse;
      const user = payload.user;
      const userId = typeof user?.id === "string" && user.id.trim() !== "" ? user.id : null;

      if (userId === null) {
        throw new UnauthorizedException("InsForge token is missing a user");
      }

      const metadata = readMetadata(user?.metadata);

      return {
        userId,
        orgId: readString(metadata, "org_id"),
        sessionId: readString(metadata, "session_id"),
        orgRole: readString(metadata, "org_role"),
        firmcodeRole: null,
        billingCapabilities: [],
        email: readNullableString(user?.email),
        emailVerified: user?.emailVerified === true,
        provider: "insforge"
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("InsForge token is invalid");
    }
  }
}

function readMetadata(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(record: Record<string, unknown>, key: string): string | null {
  return readNullableString(record[key]);
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
