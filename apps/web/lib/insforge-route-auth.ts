import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, setAuthCookies, clearAuthCookies } from "@insforge/sdk/ssr";
import type { InsForgeClient } from "@insforge/sdk";
import { loadWebInsForgeAuthRenderConfig } from "../config/insforge";

export const INSFORGE_OAUTH_CODE_VERIFIER_COOKIE = "insforge_code_verifier";

export function createInsForgeAuthRouteClient(env: Record<string, string | undefined> = process.env): InsForgeClient {
  const { baseUrl, anonKey } = loadWebInsForgeAuthRenderConfig(env);

  return createServerClient({
    baseUrl,
    anonKey
  });
}

export function jsonAuthError(message: string, status = 400): Response {
  return Response.json({ error: "AUTH_FAILED", message }, { status });
}

export function setSessionCookies(
  response: NextResponse,
  data: { accessToken?: string; refreshToken?: string | null },
  requestUrl: string
): void {
  if (typeof data.accessToken !== "string" || data.accessToken.trim() === "") {
    return;
  }

  setAuthCookies(response.cookies, {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? null
  }, {
    options: authCookieOptionsForRequest(requestUrl)
  });
}

export function clearSessionCookies(response: NextResponse, requestUrl: string): void {
  clearAuthCookies(response.cookies, {
    options: authCookieOptionsForRequest(requestUrl)
  });
}

export function readStringField(body: unknown, key: string): string | null {
  if (body === null || typeof body !== "object") {
    return null;
  }

  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function authCookieOptionsForRequest(requestUrl: string): {
  accessToken: { secure: boolean };
  refreshToken: { secure: boolean };
} {
  const secure = isSecureRequest(requestUrl);
  return {
    accessToken: { secure },
    refreshToken: { secure }
  };
}

export function isSecureRequest(requestUrl: string): boolean {
  try {
    return new URL(requestUrl).protocol === "https:";
  } catch {
    return false;
  }
}

export function getDashboardBaseUrl(env: Record<string, string | undefined> = process.env): string {
  return env.NEXT_PUBLIC_DASHBOARD_URL ?? env.APP_URL ?? "http://localhost:3000";
}

export function dashboardUrl(path: string, env: Record<string, string | undefined> = process.env): URL {
  return new URL(path, getDashboardBaseUrl(env));
}

export function getCanonicalOAuthStartRedirect(
  request: NextRequest,
  env: Record<string, string | undefined> = process.env
): URL | null {
  const dashboardBaseUrl = new URL(getDashboardBaseUrl(env));
  const requestUrl = new URL(request.url);
  const requestHostname = getRequestHostname(request) ?? requestUrl.hostname;

  if (
    dashboardBaseUrl.hostname !== "localhost" ||
    !isLocalhostAlias(requestHostname) ||
    requestHostname === dashboardBaseUrl.hostname
  ) {
    return null;
  }

  const canonicalUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, dashboardBaseUrl);
  return canonicalUrl;
}

function isLocalhostAlias(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1";
}

function getRequestHostname(request: NextRequest): string | null {
  const host = request.headers.get("host");
  if (host === null || host.trim() === "") {
    return null;
  }

  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return host.split(":")[0] ?? null;
  }
}
