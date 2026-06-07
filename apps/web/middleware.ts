import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isProtectedDashboardPath, PROTECTED_DASHBOARD_ROUTES } from "./lib/protected-routes";

// Simple middleware that allows all requests
// Authentication is handled client-side by InsForge SDK
export default async function middleware(request: NextRequest, _event: NextFetchEvent): Promise<Response> {
  // Allow all requests - auth is handled client-side
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)"
  ]
};
