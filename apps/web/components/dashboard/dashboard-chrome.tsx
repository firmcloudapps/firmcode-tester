import React from "react";
import { DashboardActiveItem } from "../../lib/dashboard-navigation";
import { DashboardClerkControls, DashboardWorkspaceLabel } from "./dashboard-clerk-controls";

interface NavigationItem {
  readonly label: string;
  readonly href: string;
  readonly enabled: boolean;
  readonly activeItem: DashboardActiveItem;
  readonly disabledTitle?: string;
}

interface DashboardChromeProps {
  activeItem: DashboardActiveItem;
  showGitHubShortcut: boolean;
  navItems: readonly NavigationItem[];
}

export function DashboardChrome({ activeItem, showGitHubShortcut, navItems }: DashboardChromeProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:pl-[17rem]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">Workspace</p>
          <p className="truncate text-sm font-semibold text-primary">
            <DashboardWorkspaceLabel />
          </p>
        </div>
        <label className="ml-auto hidden min-w-0 flex-1 max-w-2xl items-center gap-2 rounded-md border border-border bg-shell px-3 py-2 text-sm text-secondary md:flex">
          <span className="font-mono text-xs text-accent" aria-hidden="true">
            /
          </span>
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:text-secondary"
            placeholder="Search repositories, PRs, findings, and runs"
            aria-label="Global search"
          />
        </label>
        {showGitHubShortcut ? (
          <a
            className="hidden shrink-0 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-primary shadow-sm hover:border-accent sm:inline-flex"
            href="/github/installations"
          >
            Connect GitHub
          </a>
        ) : null}
        <button
          className="hidden h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-sm font-semibold text-accent shadow-sm hover:border-accent sm:inline-flex"
          type="button"
          aria-label="Notifications"
          title="Notifications"
        >
          !
        </button>
        <DashboardClerkControls />
      </div>
      <details className="border-t border-border px-4 py-2 lg:hidden">
        <summary className="cursor-pointer text-sm font-medium text-primary">Navigation</summary>
        <nav className="mt-2 grid gap-1" aria-label="Mobile dashboard">
          {navItems.map((item) => {
            const active = item.activeItem === activeItem;

            return item.enabled ? (
              <a
                key={item.label}
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  active ? "bg-blush text-accent" : "text-secondary hover:bg-blush hover:text-primary"
                }`}
                href={item.href}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </a>
            ) : (
              <span
                key={item.label}
                className="cursor-not-allowed rounded-md px-3 py-2 text-sm font-medium text-secondary opacity-55"
                aria-disabled="true"
                title={item.disabledTitle ?? "Planned dashboard section"}
              >
                {item.label}
              </span>
            );
          })}
        </nav>
      </details>
    </header>
  );
}
