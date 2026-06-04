import React from "react";
import { ADMIN_NAV_ITEMS } from "../../lib/admin-dashboard-nav";
import { type DashboardActiveItem } from "../../lib/dashboard-navigation";
import { DashboardChrome } from "./dashboard-chrome";
import { AdminDashboardSidebar } from "./admin-dashboard-sidebar";

interface AdminDashboardShellProps {
  activeItem: DashboardActiveItem;
  children: React.ReactNode;
}

export function AdminDashboardShell({ activeItem, children }: AdminDashboardShellProps) {
  return (
    <div className="min-h-screen bg-shell text-primary" data-clerk-authenticated="required">
      <DashboardChrome
        activeItem={activeItem}
        showGitHubShortcut={true}
        navItems={ADMIN_NAV_ITEMS}
      />
      <div className="flex w-full gap-0 px-3 py-4 sm:px-5 lg:px-6">
        <AdminDashboardSidebar activeItem={activeItem} />
        <main className="min-w-0 flex-1 lg:pl-64">{children}</main>
      </div>
    </div>
  );
}
