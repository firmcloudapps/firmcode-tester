export type DashboardActiveItem =
  | "Overview"
  | "PR Review"
  | "Repositories"
  | "Pull Requests"
  | "Review Runs"
  | "Findings"
  | "CI Failures"
  | "Rules"
  | "Settings"
  | "Billing";

export type DashboardNavAudience = "all" | "admin";

export interface DashboardNavItem {
  readonly label: string;
  readonly href: string;
  readonly enabled: boolean;
  readonly activeItem: DashboardActiveItem;
  readonly audience: DashboardNavAudience;
  readonly disabledTitle?: string;
}

export const DASHBOARD_NAV_ITEMS: readonly DashboardNavItem[] = [
  { label: "Overview", href: "/dashboard", enabled: true, activeItem: "Overview", audience: "all" },
  { label: "PR Review", href: "/github/installations", enabled: true, activeItem: "PR Review", audience: "all" },
  { label: "Repositories", href: "/repositories", enabled: true, activeItem: "Repositories", audience: "all" },
  { label: "Pull Requests", href: "/pull-requests", enabled: true, activeItem: "Pull Requests", audience: "all" },
  { label: "Review Runs", href: "/review-runs", enabled: true, activeItem: "Review Runs", audience: "all" },
  { label: "Findings", href: "/findings", enabled: true, activeItem: "Findings", audience: "all" },
  { label: "CI Failures", href: "/ci-failures", enabled: true, activeItem: "CI Failures", audience: "all" },
  { label: "Settings", href: "/settings", enabled: true, activeItem: "Settings", audience: "admin" },
  { label: "Billing", href: "/billing", enabled: true, activeItem: "Billing", audience: "admin" }
] as const;

export type DashboardNavRole = "admin" | "developer";

export function isAdminDashboardRole(role: string | null | undefined): boolean {
  const normalized = role?.toLowerCase();

  return normalized === "admin" || normalized === "owner";
}

export function navItemsForRole(role: string | null | undefined): readonly DashboardNavItem[] {
  if (isAdminDashboardRole(role)) {
    return DASHBOARD_NAV_ITEMS;
  }

  return DASHBOARD_NAV_ITEMS.filter((item) => item.audience === "all");
}
