import { NextResponse } from "next/server";
import { createDashboardApiHeaders } from "../../../../lib/dashboard-api-proxy";

export async function GET(request: Request): Promise<Response> {
  const callbackUrl = new URL("/github/installations/callback", process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001");
  const incomingUrl = new URL(request.url);
  const headers = await createDashboardApiHeaders(process.env, false);

  if (headers === null) {
    return NextResponse.redirect(new URL("/sign-in", getDashboardBaseUrl()));
  }

  copySearchParam(incomingUrl, callbackUrl, "installation_id");

  const response = await fetch(callbackUrl, {
    cache: "no-store",
    headers
  });

  if (!response.ok) {
    return NextResponse.redirect(new URL("/github/installations?github_installation=error", getDashboardBaseUrl()));
  }

  return NextResponse.redirect(new URL("/github/installations?github_installation=connected", getDashboardBaseUrl()));
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
