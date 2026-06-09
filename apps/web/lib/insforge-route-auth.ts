import { NextResponse } from "next/server";
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

export function setSessionCookies(response: NextResponse, data: { accessToken?: string; refreshToken?: string | null }): void {
  if (typeof data.accessToken !== "string" || data.accessToken.trim() === "") {
    return;
  }

  setAuthCookies(response.cookies, {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? null
  });
}

export function clearSessionCookies(response: NextResponse): void {
  clearAuthCookies(response.cookies);
}

export function readStringField(body: unknown, key: string): string | null {
  if (body === null || typeof body !== "object") {
    return null;
  }

  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
