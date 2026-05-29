import { NextResponse } from "next/server";
import { resolveRoleBasedDashboardRedirect } from "../../../lib/auth-redirect";
import { ensureAuthenticatedUserDefaultClerkOrganizationMembership } from "../../../lib/default-clerk-organization";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  await ensureAuthenticatedUserDefaultClerkOrganizationMembership();

  const redirectUrl = await resolveRoleBasedDashboardRedirect({ requestUrl: request.url });

  return NextResponse.redirect(redirectUrl);
}
