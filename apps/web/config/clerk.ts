import { createWebClerkConfig, type ClerkWebConfig, type EnvironmentVariables } from "@firmcode/shared";

export interface ClerkAuthRenderConfig {
  publishableKey: string;
  signInUrl: string;
  signUpUrl: string;
  afterSignInUrl: string;
  afterSignUpUrl: string;
}

export function loadWebClerkConfig(env: EnvironmentVariables = process.env): ClerkWebConfig {
  return createWebClerkConfig(env);
}

export function loadWebClerkAuthRenderConfig(env: EnvironmentVariables = process.env): ClerkAuthRenderConfig {
  const publishableKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

  if (publishableKey === undefined || publishableKey === "") {
    throw new Error("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required");
  }

  return {
    publishableKey,
    signInUrl: readRoute(env.NEXT_PUBLIC_CLERK_SIGN_IN_URL, "/sign-in"),
    signUpUrl: readRoute(env.NEXT_PUBLIC_CLERK_SIGN_UP_URL, "/sign-up"),
    afterSignInUrl: readRoute(env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL, "/auth/redirect"),
    afterSignUpUrl: readRoute(env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL, "/auth/redirect")
  };
}

function readRoute(value: string | undefined, fallback: string): string {
  const candidate = value?.trim();

  if (candidate === undefined || candidate === "") {
    return fallback;
  }

  if (candidate.startsWith("/")) {
    return candidate;
  }

  try {
    const url = new URL(candidate);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return candidate;
    }
  } catch {
    return fallback;
  }

  return fallback;
}
