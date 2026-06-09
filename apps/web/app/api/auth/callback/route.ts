import { NextRequest, NextResponse } from "next/server";
import {
  INSFORGE_OAUTH_CODE_VERIFIER_COOKIE,
  createInsForgeAuthRouteClient,
  dashboardUrl,
  getDashboardBaseUrl,
  setSessionCookies
} from "../../../../lib/insforge-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const dashboardBaseUrl = getDashboardBaseUrl();
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("insforge_code");

  if (error !== null || code === null || code.trim() === "") {
    return NextResponse.redirect(dashboardUrl("/sign-in?error=oauth_failed"));
  }

  const codeVerifier = request.cookies.get(INSFORGE_OAUTH_CODE_VERIFIER_COOKIE)?.value;

  if (codeVerifier === undefined || codeVerifier.trim() === "") {
    return NextResponse.redirect(dashboardUrl("/sign-in?error=oauth_missing_verifier"));
  }

  const client = createInsForgeAuthRouteClient();
  const { data, error: exchangeError } = await client.auth.exchangeOAuthCode(code, codeVerifier);

  if (exchangeError !== null || typeof data?.accessToken !== "string" || data.user === undefined) {
    return NextResponse.redirect(dashboardUrl("/sign-in?error=oauth_exchange_failed"));
  }

  const response = NextResponse.redirect(dashboardUrl("/auth/redirect"));
  setSessionCookies(response, {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken
  }, dashboardBaseUrl);
  response.cookies.delete(INSFORGE_OAUTH_CODE_VERIFIER_COOKIE);
  return response;
}
