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

export interface DashboardNavItem {
  readonly label: string;
  readonly href: string;
  readonly enabled: boolean;
  readonly activeItem: DashboardActiveItem;
  readonly disabledTitle?: string;
}

export const DASHBOARD_NAV_ITEMS: readonly DashboardNavItem[] = [
  { label: "Overview", href: "/dashboard", enabled: true, activeItem: "Overview" },
  { label: "PR Review", href: "/github/installations", enabled: true, activeItem: "PR Review" },
  { label: "Repositories", href: "/repositories", enabled: true, activeItem: "Repositories" },
  { label: "Pull Requests", href: "/pull-requests", enabled: true, activeItem: "Pull Requests" },
  { label: "Review Runs", href: "/review-runs", enabled: true, activeItem: "Review Runs" },
  { label: "Findings", href: "/findings", enabled: true, activeItem: "Findings" },
  { label: "CI Failures", href: "/ci-failures", enabled: true, activeItem: "CI Failures" },
  { label: "Rules / Policies", href: "/rules", enabled: true, activeItem: "Rules" },
  { label: "Settings", href: "/settings", enabled: true, activeItem: "Settings" },
  { label: "Billing", href: "/billing", enabled: true, activeItem: "Billing" }
] as const;
