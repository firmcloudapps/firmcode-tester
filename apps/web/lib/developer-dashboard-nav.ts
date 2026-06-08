import { type DashboardActiveItem } from "./dashboard-navigation";

export interface DeveloperNavItem {
  readonly label: string;
  readonly href: string;
  readonly enabled: boolean;
  readonly activeItem: DashboardActiveItem;
  readonly disabledTitle?: string;
}

export const DEVELOPER_NAV_ITEMS: readonly DeveloperNavItem[] = [
  { label: "PR Review", href: "/dashboard/developer", enabled: true, activeItem: "PR Review" },
  { label: "Repositories", href: "/repositories", enabled: true, activeItem: "Repositories" },
  { label: "Pull Requests", href: "/pull-requests", enabled: true, activeItem: "Pull Requests" },
  { label: "Review Runs", href: "/review-runs", enabled: true, activeItem: "Review Runs" },
  { label: "Findings", href: "/findings", enabled: true, activeItem: "Findings" },
  { label: "CI Failures", href: "/ci-failures", enabled: true, activeItem: "CI Failures" },
  { label: "Rules", href: "/rules", enabled: true, activeItem: "Rules" }
] as const;
