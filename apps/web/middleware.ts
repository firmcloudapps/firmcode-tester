import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { isProtectedDashboardPath, PROTECTED_DASHBOARD_ROUTES } from "./lib/protected-routes";

const isProtectedRoute = createRouteMatcher([...PROTECTED_DASHBOARD_ROUTES]);

interface ProtectableClerkAuth {
  protect(options?: { unauthenticatedUrl?: string }): Promise<unknown>;
}

export async function protectDashboardRequest(auth: ProtectableClerkAuth, request: Request): Promise<void> {
  const protectedPath =
    "nextUrl" in request ? isProtectedRoute(request as Parameters<typeof isProtectedRoute>[0]) : isProtectedDashboardPath(new URL(request.url).pathname);

  if (protectedPath) {
    await auth.protect({ unauthenticatedUrl: new URL("/sign-in", request.url).toString() });
  }
}

export default clerkMiddleware(async (auth, request) => protectDashboardRequest(auth, request));

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)"
  ]
};
