import React from "react";
import { type DashboardActiveItem } from "../../lib/dashboard-navigation";
import { DEVELOPER_NAV_ITEMS } from "../../lib/developer-dashboard-nav";
import { DashboardChrome } from "./dashboard-chrome";
import { DeveloperDashboardSidebar } from "./developer-dashboard-sidebar";

interface DeveloperDashboardShellProps {
  activeItem: DashboardActiveItem;
  children: React.ReactNode;
}

export function DeveloperDashboardShell({ activeItem, children }: DeveloperDashboardShellProps) {
  const showGitHubShortcut = activeItem !== "PR Review";

  return (
    <div className="min-h-screen bg-shell text-primary" data-clerk-authenticated="required">
      <DashboardChrome
        activeItem={activeItem}
        showGitHubShortcut={showGitHubShortcut}
        navItems={DEVELOPER_NAV_ITEMS}
      />
      <div className="flex w-full gap-0 px-3 py-4 sm:px-5 lg:px-6">
        <DeveloperDashboardSidebar activeItem={activeItem} />
        <main className="min-w-0 flex-1 lg:pl-64">{children}</main>
      </div>
    </div>
  );
}
