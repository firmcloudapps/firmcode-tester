export const EMAIL_VERIFICATION_CODE_LENGTH = 6;
export const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;

export function normalizeVerificationCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, EMAIL_VERIFICATION_CODE_LENGTH);
}

export function validateVerificationCode(value: string): string | null {
  if (value.length !== EMAIL_VERIFICATION_CODE_LENGTH) {
    return "Enter the 6-digit verification code.";
  }

  if (!/^\d{6}$/.test(value)) {
    return "Verification codes must contain digits only.";
  }

  return null;
}

export function requiresEmailVerification(message: string): boolean {
  return /(verify|verification).*(email)|email.*(verify|verification)|unverified/i.test(message);
}

export function normalizeVerificationError(message: string, action: "verify" | "resend" = "verify"): string {
  if (/(expired|timeout)/i.test(message)) {
    return "That code has expired. Request a new code and try again.";
  }

  if (/(already used|used already|already verified)/i.test(message)) {
    return "That code has already been used. Request a new code to continue.";
  }

  if (/(rate limit|too many|wait before|slow down|try again later)/i.test(message)) {
    return action === "resend"
      ? "Please wait before requesting another verification code."
      : "Too many verification attempts. Wait a moment and try again.";
  }

  if (/(invalid|incorrect|mismatch|otp)/i.test(message)) {
    return "That code is invalid. Check the 6 digits and try again.";
  }

  if (action === "resend") {
    return "We could not resend the verification code. Try again in a moment.";
  }

  return "We could not verify that code. Try again or request a new one.";
}
