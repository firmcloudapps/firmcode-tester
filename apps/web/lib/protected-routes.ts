export const PROTECTED_DASHBOARD_ROUTES = [
  "/",
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
  "/api/(.*)"
] as const;

export function isProtectedDashboardPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/auth/github" || pathname.startsWith("/auth/github/")) {
    return true;
  }

  return [
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
