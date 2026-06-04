import React from "react";
import { AdminDashboardShell } from "./admin-dashboard-shell";
import { DeveloperDashboardShell } from "./developer-dashboard-shell";
import { isAdminDashboardRole, type DashboardActiveItem } from "../../lib/dashboard-navigation";

interface DashboardShellProps {
  activeItem: DashboardActiveItem;
  children: React.ReactNode;
  role?: string | null;
}

export function DashboardShell({ activeItem, children, role }: DashboardShellProps) {
  if (isAdminDashboardRole(role)) {
    return <AdminDashboardShell activeItem={activeItem}>{children}</AdminDashboardShell>;
  }

  return <DeveloperDashboardShell activeItem={activeItem}>{children}</DeveloperDashboardShell>;
}
