/**
 * Token verification interface for InsForge dashboard auth.
 */

export interface VerifiedToken {
  readonly userId: string;
  readonly orgId: string | null;
  readonly sessionId: string | null;
  readonly orgRole: string | null;
  readonly firmcodeRole: string | null;
  readonly billingCapabilities: readonly string[];
  readonly email?: string | null;
  readonly emailVerified?: boolean;
  readonly provider: "insforge";
}

export interface TokenVerifier {
  verify(token: string): Promise<VerifiedToken>;
}

export const TOKEN_VERIFIER = Symbol("TOKEN_VERIFIER");
