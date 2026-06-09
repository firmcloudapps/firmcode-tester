import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_REFRESH_TOKEN_COOKIE } from "@insforge/sdk/ssr";
import { refreshAuth } from "@insforge/sdk/ssr";
import { loadWebInsForgeAuthRenderConfig } from "../../../../config/insforge";
import {
  authCookieOptionsForRequest,
  clearSessionCookies,
  getDashboardBaseUrl
} from "../../../../lib/insforge-route-auth";

export const dynamic = "force-dynamic";

const { baseUrl, anonKey } = loadWebInsForgeAuthRenderConfig();

export async function POST(request: NextRequest): Promise<Response> {
  if (request.cookies.get(DEFAULT_REFRESH_TOKEN_COOKIE)?.value === undefined) {
    const response = new NextResponse(null, { status: 204 });
    clearSessionCookies(response, getDashboardBaseUrl());
    return response;
  }

  const result = await refreshAuth({
    request,
    baseUrl,
    anonKey,
    options: authCookieOptionsForRequest(getDashboardBaseUrl())
  });

  return result.response;
}
