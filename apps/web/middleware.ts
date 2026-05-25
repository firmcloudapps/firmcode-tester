import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { PROTECTED_DASHBOARD_ROUTES } from "./lib/protected-routes";

const isProtectedRoute = createRouteMatcher([...PROTECTED_DASHBOARD_ROUTES]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"]
};
