export type DashboardDestinationKind = "internal" | "external";
export type DashboardExternalProvider = "clerk" | "github";

export interface DashboardRoutePattern {
  readonly pattern: string;
  readonly kind: "page" | "route-handler";
}

export interface DashboardDestinationReadiness {
  readonly kind: DashboardDestinationKind;
  readonly routeReady: boolean;
  readonly pathname: string;
}

export const DASHBOARD_IMPLEMENTED_ROUTE_PATTERNS: readonly DashboardRoutePattern[] = [
  { pattern: "/", kind: "page" },
  { pattern: "/admin", kind: "page" },
  { pattern: "/auth/github", kind: "route-handler" },
  { pattern: "/auth/redirect", kind: "route-handler" },
  { pattern: "/api/auth/github/callback", kind: "route-handler" },
  { pattern: "/billing", kind: "page" },
  { pattern: "/ci-failures", kind: "page" },
  { pattern: "/ci-failures/[id]", kind: "page" },
  { pattern: "/dashboard", kind: "page" },
  { pattern: "/dashboard/admin", kind: "page" },
  { pattern: "/dashboard/developer", kind: "page" },
  { pattern: "/findings", kind: "page" },
  { pattern: "/developer", kind: "page" },
  { pattern: "/github/installations", kind: "page" },
  { pattern: "/github/installations/callback", kind: "route-handler" },
  { pattern: "/pull-requests", kind: "page" },
  { pattern: "/pull-requests/[id]", kind: "page" },
  { pattern: "/repositories", kind: "page" },
  { pattern: "/repositories/[id]", kind: "page" },
  { pattern: "/review-runs", kind: "page" },
  { pattern: "/review-runs/[id]", kind: "page" },
  { pattern: "/rules", kind: "page" },
  { pattern: "/settings", kind: "page" },
  { pattern: "/api/github/installations/sync", kind: "route-handler" },
  { pattern: "/api/github/oauth/status", kind: "route-handler" },
  { pattern: "/api/repositories/[id]", kind: "route-handler" },
  { pattern: "/api/repositories/[id]/activity", kind: "route-handler" },
  { pattern: "/api/repositories/[id]/configuration", kind: "route-handler" },
  { pattern: "/api/repositories/[id]/sync", kind: "route-handler" },
  { pattern: "/api/review-runs/[id]/artifacts/[artifactId]/raw", kind: "route-handler" },
  { pattern: "/api/review-runs/[id]/retry", kind: "route-handler" },
  { pattern: "/api/rules", kind: "route-handler" },
  { pattern: "/api/settings/members/[clerkUserId]/role", kind: "route-handler" },
  { pattern: "/api/settings/members/[clerkUserId]/status", kind: "route-handler" },
  { pattern: "/api/pull-requests", kind: "route-handler" },
  { pattern: "/api/pull-requests/[id]", kind: "route-handler" },
  { pattern: "/api/ci-failures", kind: "route-handler" },
  { pattern: "/api/ci-failures/[id]", kind: "route-handler" }
] as const;

const routeMatchers = DASHBOARD_IMPLEMENTED_ROUTE_PATTERNS.map((route) => ({
  ...route,
  matcher: routePatternToRegExp(route.pattern)
}));

export function isExternalDashboardUrl(href: string): boolean {
  return href.startsWith("https://") || href.startsWith("http://");
}

export function isImplementedDashboardRoute(href: string): boolean {
  const destination = classifyDashboardDestination(href);

  return destination.kind === "external" || destination.routeReady;
}

export function classifyDashboardDestination(href: string): DashboardDestinationReadiness {
  if (isExternalDashboardUrl(href)) {
    return {
      kind: "external",
      routeReady: true,
      pathname: href
    };
  }

  const pathname = normalizeInternalPathname(href);

  return {
    kind: "internal",
    routeReady: routeMatchers.some((route) => route.matcher.test(pathname)),
    pathname
  };
}

export function isAllowedExternalDashboardUrl(href: string, provider: DashboardExternalProvider): boolean {
  if (!isExternalDashboardUrl(href)) {
    return false;
  }

  const hostname = new URL(href).hostname.toLowerCase();

  if (provider === "github") {
    return hostname === "github.com" || hostname.endsWith(".github.com");
  }

  return hostname.includes("clerk") || hostname.includes("accounts") || hostname.includes("billing");
}

function normalizeInternalPathname(href: string): string {
  const withoutHash = href.split("#", 1)[0] ?? href;
  const withoutQuery = withoutHash.split("?", 1)[0] ?? withoutHash;

  return withoutQuery === "" ? "/" : withoutQuery;
}

function routePatternToRegExp(pattern: string): RegExp {
  if (pattern === "/") {
    return /^\/$/;
  }

  const segments = pattern
    .split("/")
    .filter(Boolean)
    .map((segment) => (segment.startsWith("[") && segment.endsWith("]") ? "[^/]+" : escapeRegExp(segment)));

  return new RegExp(`^/${segments.join("/")}$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
