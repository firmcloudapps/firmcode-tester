import { NextResponse } from "next/server";
import {
  INSFORGE_OAUTH_CODE_VERIFIER_COOKIE,
  createInsForgeAuthRouteClient
} from "../../../../lib/insforge-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const client = createInsForgeAuthRouteClient();
  const redirectTo = new URL("/api/auth/callback", request.url).toString();
  const { data, error } = await client.auth.signInWithOAuth("google", {
    redirectTo,
    skipBrowserRedirect: true,
    additionalParams: {
      prompt: "select_account"
    }
  });

  if (error !== null || data.url === undefined || data.codeVerifier === undefined) {
    return NextResponse.redirect(new URL("/sign-in?error=oauth_start_failed", request.url));
  }

  const response = NextResponse.redirect(data.url);
  response.cookies.set(INSFORGE_OAUTH_CODE_VERIFIER_COOKIE, data.codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600
  });
  return response;
}
