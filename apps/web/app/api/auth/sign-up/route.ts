import { NextResponse } from "next/server";
import {
  createInsForgeAuthRouteClient,
  getDashboardBaseUrl,
  jsonAuthError,
  readStringField,
  setSessionCookies
} from "../../../../lib/insforge-route-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const email = readStringField(body, "email");
  const password = readStringField(body, "password");
  const name = readStringField(body, "name") ?? undefined;

  if (email === null || password === null) {
    return jsonAuthError("Email and password are required.", 400);
  }

  const client = createInsForgeAuthRouteClient();
  const dashboardBaseUrl = getDashboardBaseUrl();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    name,
    redirectTo: new URL("/sign-in", dashboardBaseUrl).toString()
  });

  if (error !== null) {
    return jsonAuthError(error.message, error.statusCode ?? 400);
  }

  if (typeof data?.accessToken === "string" && data.user !== undefined) {
    const response = NextResponse.json({ user: data.user, requireEmailVerification: false });
    setSessionCookies(response, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    }, dashboardBaseUrl);
    return response;
  }

  return NextResponse.json({
    user: data?.user ?? null,
    requireEmailVerification: data?.requireEmailVerification ?? true
  });
}
