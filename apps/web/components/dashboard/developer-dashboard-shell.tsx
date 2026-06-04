import React from "react";
import { type DashboardActiveItem } from "../../lib/dashboard-navigation";
import { DEVELOPER_NAV_ITEMS } from "../../lib/developer-dashboard-nav";
import { DashboardChrome } from "./dashboard-chrome";
import { DashboardWorkspaceLabel } from "./dashboard-clerk-controls";

interface DeveloperDashboardShellProps {
  activeItem: DashboardActiveItem;
  children: React.ReactNode;
}

export function DeveloperDashboardShell({ activeItem, children }: DeveloperDashboardShellProps) {
  const navItems = DEVELOPER_NAV_ITEMS;
  const showGitHubShortcut = activeItem !== "PR Review";

  return (
    <div className="min-h-screen bg-shell text-primary" data-clerk-authenticated="required">
      <DashboardChrome
        activeItem={activeItem}
        showGitHubShortcut={showGitHubShortcut}
        navItems={navItems}
      />
      <div className="flex w-full gap-0 px-3 py-4 sm:px-5 lg:px-6">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface px-4 py-5 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-lg font-black text-white shadow-sm">
              PR
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">
                Workspace
              </p>
              <div className="truncate text-base font-semibold text-primary">
                <DashboardWorkspaceLabel />
              </div>
            </div>
          </div>
          <nav className="flex flex-col gap-1" aria-label="Dashboard">
            {navItems.map((item) => {
              const active = item.activeItem === activeItem;

              return item.enabled ? (
                <a
                  key={item.label}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "border-border bg-blush text-primary shadow-sm"
                      : "border-transparent text-secondary hover:border-border hover:bg-shell hover:text-primary"
                  }`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </a>
              ) : (
                <span
                  key={item.label}
                  className="cursor-not-allowed rounded-md border border-transparent px-3 py-2 text-sm font-medium text-secondary opacity-55"
                  aria-disabled="true"
                  title={item.disabledTitle ?? "Planned dashboard section"}
                >
                  {item.label}
                </span>
              );
            })}
          </nav>
          <div className="absolute bottom-5 left-4 right-4 border-t border-border pt-4">
            <p className="text-xs font-medium text-primary">Signed in with Clerk</p>
            <div className="mt-1 truncate text-xs text-secondary">
              <DashboardWorkspaceLabel />
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 lg:pl-64">{children}</main>
      </div>
    </div>
  );
}
