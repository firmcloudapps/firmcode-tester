import { NextResponse } from "next/server";
import type { GitHubOAuthStartResponse } from "@firmcode/shared";
import { createDashboardApiHeaders } from "../../../lib/dashboard-api-proxy";

export async function GET(): Promise<Response> {
  const response = await fetch(new URL("/auth/github", process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"), {
    cache: "no-store",
    headers: createDashboardApiHeaders(process.env, false)
  });
  const payload = (await readJsonPayload(response)) as Partial<GitHubOAuthStartResponse> | null;

  if (!response.ok || payload === null || typeof payload.authorizationUrl !== "string") {
    return NextResponse.redirect(new URL("/github/installations?github_oauth=error", getDashboardBaseUrl()));
  }

  return NextResponse.redirect(payload.authorizationUrl);
}

async function readJsonPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getDashboardBaseUrl(): string {
  return process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000";
}
