import { NextResponse } from "next/server";
import {
  createInsForgeAuthRouteClient,
  jsonAuthError,
  readStringField,
  setSessionCookies
} from "../../../../lib/insforge-route-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const email = readStringField(body, "email");
  const otp = readStringField(body, "otp");

  if (email === null || otp === null) {
    return jsonAuthError("Email and verification code are required.", 400);
  }

  const client = createInsForgeAuthRouteClient();
  const { data, error } = await client.auth.verifyEmail({ email, otp });

  if (error !== null) {
    return jsonAuthError(error.message, error.statusCode ?? 400);
  }

  if (typeof data?.accessToken !== "string" || data.user === undefined) {
    return jsonAuthError("Verification did not return an authenticated session.", 401);
  }

  const response = NextResponse.json({ user: data.user });
  setSessionCookies(response, {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken
  });
  return response;
}
