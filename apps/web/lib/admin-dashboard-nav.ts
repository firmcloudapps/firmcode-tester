import { type DashboardActiveItem } from "./dashboard-navigation";

export interface AdminNavItem {
  readonly label: string;
  readonly href: string;
  readonly enabled: boolean;
  readonly activeItem: DashboardActiveItem;
  readonly disabledTitle?: string;
}

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { label: "Overview", href: "/dashboard", enabled: true, activeItem: "Overview" },
  { label: "Settings", href: "/settings", enabled: true, activeItem: "Settings" },
  { label: "Billing", href: "/billing", enabled: true, activeItem: "Billing" }
] as const;
