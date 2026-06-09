import {
  createInsForgeAuthRouteClient,
  getDashboardBaseUrl,
  jsonAuthError,
  readStringField
} from "../../../../lib/insforge-route-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const email = readStringField(body, "email");

  if (email === null) {
    return jsonAuthError("Email is required.", 400);
  }

  const client = createInsForgeAuthRouteClient();
  const dashboardBaseUrl = getDashboardBaseUrl();
  const { data, error } = await client.auth.resendVerificationEmail({
    email,
    redirectTo: new URL("/sign-in", dashboardBaseUrl).toString()
  });

  if (error !== null) {
    return jsonAuthError(error.message, error.statusCode ?? 400);
  }

  return Response.json(data ?? { success: true });
}
