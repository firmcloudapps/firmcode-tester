import React from "react";

interface DashboardShellProps {
  activeItem: "Overview" | "Repositories" | "Review Runs" | "Findings" | "CI Failures" | "Rules" | "Settings" | "Billing";
  children: React.ReactNode;
}

const navItems = [
  { label: "Overview", href: "/" },
  { label: "Repositories", href: "/repositories" },
  { label: "Pull Requests", href: "/pull-requests" },
  { label: "Review Runs", href: "/review-runs" },
  { label: "Findings", href: "/findings" },
  { label: "CI Failures", href: "/ci-failures" },
  { label: "Rules / Policies", href: "/rules" },
  { label: "Settings", href: "/settings" },
  { label: "Billing", href: "/billing" }
];

export function DashboardShell({ activeItem, children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-shell text-primary" data-clerk-authenticated="required">
      <header className="sticky top-0 z-20 border-b border-border bg-surface">
        <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-secondary">Workspace</p>
            <p className="truncate text-sm font-semibold text-primary">Personal engineering</p>
          </div>
          <label className="ml-auto hidden min-w-0 flex-1 max-w-lg items-center gap-2 rounded-md border border-border bg-subtle px-3 py-2 text-sm text-secondary md:flex">
            <span className="font-mono text-xs" aria-hidden="true">
              /
            </span>
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-secondary"
              placeholder="Search repositories, PRs, findings, and runs"
              aria-label="Global search"
            />
          </label>
          <a
            className="hidden shrink-0 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-primary sm:inline-flex"
            href="/github/installations"
          >
            Connect GitHub
          </a>
          <button
            className="hidden h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-sm font-semibold text-primary sm:inline-flex"
            type="button"
            aria-label="Notifications"
            title="Notifications"
          >
            !
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-subtle text-xs font-semibold text-primary">
            KO
          </div>
        </div>
        <details className="border-t border-border px-4 py-2 lg:hidden">
          <summary className="cursor-pointer text-sm font-medium text-primary">Navigation</summary>
          <nav className="mt-2 grid gap-1" aria-label="Mobile dashboard">
            {navItems.map((item) => {
              const normalizedLabel = item.label === "Rules / Policies" ? "Rules" : item.label;
              const active = normalizedLabel === activeItem;

              return (
                <a
                  key={item.label}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    active ? "bg-blue-50 text-accent" : "text-secondary hover:bg-subtle hover:text-primary"
                  }`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </details>
      </header>
      <div className="mx-auto flex w-full max-w-7xl gap-0 px-3 py-4 sm:px-6 lg:px-8">
        <aside className="hidden w-60 shrink-0 pr-5 lg:block">
          <nav className="sticky top-20 flex flex-col gap-1" aria-label="Dashboard">
            {navItems.map((item) => {
              const normalizedLabel = item.label === "Rules / Policies" ? "Rules" : item.label;
              const active = normalizedLabel === activeItem;

              return (
                <a
                  key={item.label}
                  className={`rounded-md border px-3 py-2 text-sm font-medium ${
                    active
                      ? "border-blue-100 bg-blue-50 text-accent"
                      : "border-transparent text-secondary hover:border-border hover:bg-surface hover:text-primary"
                  }`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
