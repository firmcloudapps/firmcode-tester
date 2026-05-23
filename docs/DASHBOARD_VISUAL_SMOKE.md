# Dashboard Visual Smoke Checks

Use these checks after dashboard page changes that affect responsive layout.

## Overview And Findings

1. Start the web app:

```bash
npm run dev --workspace @firmcode/web
```

2. Inspect:

- Desktop: `http://localhost:3000/` at 1440px wide.
- Mobile: `http://localhost:3000/` at 390px wide.

For the Overview page, confirm the metric row, Recent Review Runs table, Needs Attention panel, and Review Quality section stay readable, do not overlap, and keep the compact light-mode dashboard styling from `docs/DASHBOARD_DESIGN.md`.

For the Findings page, inspect `http://localhost:3000/findings` on desktop and mobile. Confirm the filter controls wrap cleanly, the findings list scrolls horizontally only inside its bordered surface on small screens, severity/status badges remain readable, and the detail panel content does not overlap links or evidence snippets.

## Settings Shell

1. Start the web app if it is not already running:

```bash
npm run dev --workspace @firmcode/web
```

2. Open `/settings`, then verify at desktop width and a narrow mobile width:

- The Settings sidebar item is active.
- The General, GitHub App, Members, API Keys, Data Retention, and Notifications tabs fit without text overlap.
- Lower-role sensitive actions render as disabled while read-only workspace context remains visible.
- Empty GitHub installation state and populated installation cards do not overflow.

The automated component tests cover tab active state, loading, empty, error, populated, Clerk-gated shell, and role-based disabled states. The manual responsive smoke remains a visual layout check because the MVP test stack does not include Playwright screenshots yet.

## Billing Shell

1. Start the web app if it is not already running:

```bash
npm run dev --workspace @firmcode/web
```

2. Open `/billing`, then verify at desktop width and a narrow mobile width:

- The Billing sidebar item is active inside the dashboard shell.
- Current plan, monthly review runs, AI tokens, repositories, seats, billing status, and usage period remain readable without overlap.
- The Manage subscription action links to the configured Clerk Billing portal URL when `CLERK_BILLING_PORTAL_URL` is set.
- When `CLERK_BILLING_PORTAL_URL` is missing, the action is disabled and the warning explains that Clerk Billing is not configured.
- Lower-role or unauthenticated responses show the Billing access denied state instead of exposing payment controls.

The automated component and API tests cover populated, missing portal URL, loading/error states, Clerk-gated access, and elevated role checks. This manual smoke is for responsive layout and visual polish.
