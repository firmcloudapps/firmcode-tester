import { NextResponse } from "next/server";
import { resolveRoleBasedDashboardRedirect } from "../../../lib/auth-redirect";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const redirectUrl = await resolveRoleBasedDashboardRedirect({ requestUrl: request.url });

  return NextResponse.redirect(redirectUrl);
}
