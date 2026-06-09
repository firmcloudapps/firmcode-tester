import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  INSFORGE_OAUTH_CODE_VERIFIER_COOKIE,
  createInsForgeAuthRouteClient,
  dashboardUrl,
  getCanonicalOAuthStartRedirect,
  getDashboardBaseUrl,
  isSecureRequest
} from "../../../../lib/insforge-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const canonicalRedirect = getCanonicalOAuthStartRedirect(request);
  if (canonicalRedirect !== null) {
    return NextResponse.redirect(canonicalRedirect);
  }

  const client = createInsForgeAuthRouteClient();
  const dashboardBaseUrl = getDashboardBaseUrl();
  const redirectTo = new URL("/api/auth/callback", dashboardBaseUrl).toString();
  const { data, error } = await client.auth.signInWithOAuth("google", {
    redirectTo,
    skipBrowserRedirect: true,
    additionalParams: {
      prompt: "select_account"
    }
  });

  if (error !== null || data.url === undefined || data.codeVerifier === undefined) {
    return NextResponse.redirect(dashboardUrl("/sign-in?error=oauth_start_failed"));
  }

  const response = NextResponse.redirect(data.url);
  response.cookies.set(INSFORGE_OAUTH_CODE_VERIFIER_COOKIE, data.codeVerifier, {
    httpOnly: true,
    secure: isSecureRequest(dashboardBaseUrl),
    sameSite: "lax",
    path: "/",
    maxAge: 600
  });
  return response;
}
