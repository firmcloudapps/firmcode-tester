export interface InsForgeAuthRenderConfig {
  baseUrl: string;
  anonKey: string;
  signInUrl: string;
  signUpUrl: string;
  afterSignInUrl: string;
  afterSignUpUrl: string;
}

export function loadWebInsForgeAuthRenderConfig(
  env: Record<string, string | undefined> = process.env
): InsForgeAuthRenderConfig {
  const baseUrl = env.NEXT_PUBLIC_INSFORGE_BASE_URL || "https://h35yzuga.eu-central.insforge.app";
  const anonKey = env.NEXT_PUBLIC_INSFORGE_ANON_KEY || "";
  const signInUrl = env.NEXT_PUBLIC_INSFORGE_SIGN_IN_URL || "/sign-in";
  const signUpUrl = env.NEXT_PUBLIC_INSFORGE_SIGN_UP_URL || "/sign-up";
  const afterSignInUrl = env.NEXT_PUBLIC_INSFORGE_AFTER_SIGN_IN_URL || "/auth/redirect";
  const afterSignUpUrl = env.NEXT_PUBLIC_INSFORGE_AFTER_SIGN_UP_URL || "/auth/redirect";

  return {
    baseUrl,
    anonKey,
    signInUrl,
    signUpUrl,
    afterSignInUrl,
    afterSignUpUrl
  };
}

export function hasInsForgeConfig(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(env.NEXT_PUBLIC_INSFORGE_ANON_KEY) && Boolean(env.NEXT_PUBLIC_INSFORGE_BASE_URL);
}

export function getAuthProvider(
  env: Record<string, string | undefined> = process.env
): "clerk" | "insforge" {
  const provider = env.NEXT_PUBLIC_AUTH_PROVIDER?.toLowerCase();
  return provider === "clerk" ? "clerk" : "insforge";
}
