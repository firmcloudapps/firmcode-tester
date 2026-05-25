export const PROTECTED_DASHBOARD_ROUTES = [
  "/",
  "/admin(.*)",
  "/developer(.*)",
  "/repositories(.*)",
  "/review-runs(.*)",
  "/findings(.*)",
  "/pull-requests(.*)",
  "/ci-failures(.*)",
  "/rules(.*)",
  "/settings(.*)",
  "/billing(.*)",
  "/github/installations(.*)",
  "/auth/github(.*)",
  "/auth/redirect(.*)",
  "/api/(.*)"
] as const;

export function isProtectedDashboardPath(pathname: string): boolean {
  if (
    pathname === "/" ||
    pathname === "/auth/github" ||
    pathname.startsWith("/auth/github/") ||
    pathname === "/auth/redirect" ||
    pathname.startsWith("/auth/redirect/")
  ) {
    return true;
  }

  return [
    "/admin",
    "/developer",
    "/repositories",
    "/review-runs",
    "/findings",
    "/pull-requests",
    "/ci-failures",
    "/rules",
    "/settings",
    "/billing",
    "/github/installations",
    "/api"
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
