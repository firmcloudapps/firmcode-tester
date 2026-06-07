/**
 * Generic token verification interface for multi-provider auth.
 * Both Clerk and InsForge implement this interface.
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
  readonly provider: "clerk" | "insforge";
}

export interface TokenVerifier {
  verify(token: string): Promise<VerifiedToken>;
}

export const TOKEN_VERIFIER = Symbol("TOKEN_VERIFIER");
