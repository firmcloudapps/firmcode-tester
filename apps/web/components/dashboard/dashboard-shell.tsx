import React from "react";

interface DashboardShellProps {
  activeItem: "Overview" | "Repositories" | "Review Runs" | "Findings" | "CI Failures" | "Rules" | "Settings" | "Billing";
  children: React.ReactNode;
}

const navItems = [
  { label: "Overview", href: "/", enabled: true },
  { label: "Repositories", href: "/repositories", enabled: true },
  { label: "Pull Requests", href: "/pull-requests", enabled: false },
  { label: "Review Runs", href: "/review-runs", enabled: true },
  { label: "Findings", href: "/findings", enabled: true },
  { label: "CI Failures", href: "/ci-failures", enabled: false },
  { label: "Rules / Policies", href: "/rules", enabled: false },
  { label: "Settings", href: "/settings", enabled: true },
  { label: "Billing", href: "/billing", enabled: true }
];

export function DashboardShell({ activeItem, children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-shell text-primary" data-clerk-authenticated="required">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:pl-[17rem]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">Workspace</p>
            <p className="truncate text-sm font-semibold text-primary">Personal engineering</p>
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
          <button
            className="hidden shrink-0 cursor-not-allowed rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-secondary shadow-sm opacity-75 sm:inline-flex"
            type="button"
            disabled
            title="GitHub App connection is not wired to an install flow yet"
          >
            Connect GitHub
          </button>
          <button
            className="hidden h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-sm font-semibold text-accent shadow-sm hover:border-accent sm:inline-flex"
            type="button"
            aria-label="Notifications"
            title="Notifications"
          >
            !
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-xs font-semibold text-white shadow-sm">
            KO
          </div>
        </div>
        <details className="border-t border-border px-4 py-2 lg:hidden">
          <summary className="cursor-pointer text-sm font-medium text-primary">Navigation</summary>
          <nav className="mt-2 grid gap-1" aria-label="Mobile dashboard">
            {navItems.map((item) => {
              const normalizedLabel = item.label === "Rules / Policies" ? "Rules" : item.label;
              const active = normalizedLabel === activeItem;

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
                  title="Planned dashboard section"
                >
                  {item.label}
                </span>
              );
            })}
          </nav>
        </details>
      </header>
      <div className="flex w-full gap-0 px-3 py-4 sm:px-5 lg:px-6">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface px-4 py-5 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-lg font-black text-white shadow-sm">
              F
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">Company</p>
              <p className="truncate text-base font-semibold text-primary">Firmcode</p>
            </div>
          </div>
          <nav className="flex flex-col gap-1" aria-label="Dashboard">
            {navItems.map((item) => {
              const normalizedLabel = item.label === "Rules / Policies" ? "Rules" : item.label;
              const active = normalizedLabel === activeItem;

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
                  title="Planned dashboard section"
                >
                  {item.label}
                </span>
              );
            })}
          </nav>
          <div className="absolute bottom-5 left-4 right-4 border-t border-border pt-4">
            <p className="text-xs font-medium text-primary">Kelly O.</p>
            <p className="mt-1 truncate text-xs text-secondary">Dashboard workspace</p>
          </div>
        </aside>
        <main className="min-w-0 flex-1 lg:pl-64">{children}</main>
      </div>
    </div>
  );
}
