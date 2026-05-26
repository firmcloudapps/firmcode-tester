import React from "react";

export default function Page() {
  return (
    <main className="min-h-screen bg-shell text-primary">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-between px-5 py-6 sm:px-8 lg:px-10">
        <nav className="flex items-center justify-between gap-4" aria-label="Primary">
          <a className="flex min-w-0 items-center gap-3" href="/">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-lg font-black text-white shadow-sm">
              F
            </span>
            <span className="truncate text-base font-semibold">Firmcode</span>
          </a>
          <a
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary shadow-sm hover:border-accent"
            href="/sign-in"
          >
            Sign in
          </a>
        </nav>

        <div className="grid gap-8 py-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">AI pull request review</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-primary sm:text-5xl lg:text-6xl">
              Firmcode is getting the workspace ready.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-secondary sm:text-lg">
              Sign in to continue into the role-aware dashboard for review operations, GitHub setup, repository automation,
              and workspace controls.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accentPressed"
                href="/sign-in"
              >
                Continue
              </a>
              <a
                className="rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-primary shadow-sm hover:border-accent"
                href="/dashboard/developer"
              >
                Developer dashboard
              </a>
              <a
                className="rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-primary shadow-sm hover:border-accent"
                href="/dashboard/admin"
              >
                Admin dashboard
              </a>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm" aria-label="Dashboard entry points">
            {[
              ["Admin", "Workspace settings, billing, members, and global controls"],
              ["Developer", "PR review setup, GitHub connections, and repository automation"],
              ["Auth", "Successful sign-in routes through the protected role resolver"]
            ].map(([label, detail]) => (
              <div key={label} className="rounded-md border border-border bg-shell p-4">
                <p className="text-sm font-semibold text-primary">{label}</p>
                <p className="mt-1 text-sm leading-6 text-secondary">{detail}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs font-medium text-secondary">Protected dashboards live at /dashboard/admin and /dashboard/developer.</p>
      </section>
    </main>
  );
}
