import { createBrowserClient } from "@insforge/sdk/ssr";
import type { InsForgeClient } from "@insforge/sdk";
import { loadWebInsForgeAuthRenderConfig } from "../config/insforge";

interface CurrentSessionResponse {
  readonly user?: unknown;
}

interface PublicAuthConfigResponse {
  readonly requireEmailVerification?: unknown;
  readonly verifyEmailMethod?: unknown;
}

export function createInsForgeBrowserClient(): InsForgeClient {
  const { baseUrl, anonKey } = loadWebInsForgeAuthRenderConfig();
  const browserAnonKey = anonKey || (typeof window === "undefined" ? "server-render-placeholder-anon-key" : "");

  return createBrowserClient({
    baseUrl,
    anonKey: browserAnonKey
  });
}

export async function fetchInsForgeCurrentUser(accessToken: string, fetcher: typeof fetch = fetch): Promise<unknown | null> {
  const token = accessToken.trim();

  if (token === "") {
    return null;
  }

  const { baseUrl } = loadWebInsForgeAuthRenderConfig();
  const response = await fetcher(new URL("/api/auth/sessions/current", baseUrl), {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null) as CurrentSessionResponse | null;
  return payload?.user ?? null;
}

export async function fetchInsForgePublicAuthConfig(fetcher: typeof fetch = fetch): Promise<PublicAuthConfigResponse | null> {
  const { baseUrl, anonKey } = loadWebInsForgeAuthRenderConfig();

  if (anonKey.trim() === "") {
    return null;
  }

  const response = await fetcher(new URL("/api/auth/public-config", baseUrl), {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${anonKey}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  return await response.json().catch(() => null) as PublicAuthConfigResponse | null;
}
