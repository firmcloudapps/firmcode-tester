import { NextResponse } from "next/server";
import { createDashboardApiHeaders } from "../../../../../lib/dashboard-api-proxy";

export async function GET(request: Request): Promise<Response> {
  const callbackUrl = new URL("/auth/github/callback", process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001");
  const incomingUrl = new URL(request.url);

  copySearchParam(incomingUrl, callbackUrl, "code");
  copySearchParam(incomingUrl, callbackUrl, "state");

  const response = await fetch(callbackUrl, {
    cache: "no-store",
    headers: createDashboardApiHeaders(process.env, false)
  });

  if (!response.ok) {
    return NextResponse.redirect(new URL("/github/installations?github_oauth=error", getDashboardBaseUrl()));
  }

  return NextResponse.redirect(new URL("/github/installations?github_oauth=connected", getDashboardBaseUrl()));
}

function copySearchParam(source: URL, target: URL, name: string): void {
  const value = source.searchParams.get(name);

  if (value !== null) {
    target.searchParams.set(name, value);
  }
}

function getDashboardBaseUrl(): string {
  return process.env.NEXT_PUBLIC_DASHBOARD_URL ?? process.env.APP_URL ?? "http://localhost:3000";
}
