import { NextResponse } from "next/server";
import { clearSessionCookies, getDashboardBaseUrl } from "../../../../lib/insforge-route-auth";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response, getDashboardBaseUrl());
  return response;
}
