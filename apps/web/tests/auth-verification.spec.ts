import {
  DEFAULT_RESEND_COOLDOWN_SECONDS,
  EMAIL_VERIFICATION_CODE_LENGTH,
  normalizeVerificationCode,
  normalizeVerificationError,
  requiresEmailVerification,
  validateVerificationCode
} from "../lib/auth-verification";

describe("email verification helpers", () => {
  it("normalizes OTP input down to a 6-digit code", () => {
    expect(EMAIL_VERIFICATION_CODE_LENGTH).toBe(6);
    expect(DEFAULT_RESEND_COOLDOWN_SECONDS).toBe(60);
    expect(normalizeVerificationCode("12a3-4567")).toBe("123456");
  });

  it("validates missing or malformed codes", () => {
    expect(validateVerificationCode("12345")).toBe("Enter the 6-digit verification code.");
    expect(validateVerificationCode("12ab56")).toBe("Verification codes must contain digits only.");
    expect(validateVerificationCode("123456")).toBeNull();
  });

  it("recognizes verification-required sign-in failures", () => {
    expect(requiresEmailVerification("Email verification required before sign in")).toBe(true);
    expect(requiresEmailVerification("Please verify your email address")).toBe(true);
    expect(requiresEmailVerification("Invalid password")).toBe(false);
  });

  it("maps backend verification errors into user-safe messages", () => {
    expect(normalizeVerificationError("otp expired")).toContain("expired");
    expect(normalizeVerificationError("already used code")).toContain("already been used");
    expect(normalizeVerificationError("invalid otp")).toContain("invalid");
    expect(normalizeVerificationError("rate limit exceeded", "resend")).toContain("Please wait");
  });
});
