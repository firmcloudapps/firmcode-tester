# Dashboard Visual Smoke Checks

Use these checks after dashboard page changes that affect navigation, primary actions, or responsive layout.

## Start The App

Run the local dashboard:

```bash
npm run dev --workspace @firmcode/web
```

If the API is not running on `NEXT_PUBLIC_API_URL` or `http://localhost:3001`, pages should still render usable dashboard error states instead of Next.js 404 pages.

## Route Coverage

Inspect these active dashboard routes on desktop at 1440px wide and mobile at 390px wide:

- `http://localhost:3000/`
- `http://localhost:3000/github/installations`
- `http://localhost:3000/repositories`
- `http://localhost:3000/pull-requests`
- `http://localhost:3000/review-runs`
- `http://localhost:3000/findings`
- `http://localhost:3000/ci-failures`
- `http://localhost:3000/rules`
- `http://localhost:3000/settings`
- `http://localhost:3000/billing`

Confirm each route renders inside the full-width light dashboard shell, marks the correct sidebar/mobile navigation item active, and does not show a framework 404 page.

## Visual Checks

- Overview: metric row, Recent Review Runs table, Needs Attention panel, and Review Quality section stay readable, do not overlap, and keep compact dashboard styling.
- PR Review: GitHub provider tab is active, planned providers are disabled, setup cards fit at desktop and mobile widths, and unavailable setup actions render as disabled controls with titles.
- Repositories: filter controls wrap cleanly, the table scrolls only inside its bordered surface, row actions do not lead to missing routes, and disabled sync/configuration states are visually clear.
- Pull Requests: the desktop table and mobile cards are both present at their target breakpoints, links point to implemented detail routes, and long titles/repository names do not escape their containers.
- Review Runs: filters wrap cleanly, the pipeline table remains usable at laptop width, retry controls expose disabled reasons where applicable, and long commit/run identifiers remain contained.
- Findings: filter controls wrap cleanly, the findings list scrolls horizontally only inside its bordered surface on small screens, severity/status badges remain readable, and detail content does not overlap links or evidence snippets.
- CI Failures: mobile cards replace the dense table on narrow screens, redacted log excerpts remain collapsed by default, and related artifact controls are disabled when raw access is not allowed.
- Rules / Policies: form controls keep labels, validation text, and disabled read-only state visible without horizontal page overflow.
- Settings: General, GitHub App, Members, API Keys, Data Retention, and Notifications tabs fit without text overlap; Clerk-owned internal fallbacks render disabled until route-ready.
- Billing: the Clerk-managed billing entry point is active only for authorized users with an external Clerk billing URL; otherwise Manage Subscription is disabled with an explanatory title.

## Automated Coverage

Run component and route-readiness coverage:

```bash
npm run test --workspace @firmcode/web
```

For this task, `apps/web/tests/dashboard-visual-smoke.spec.tsx` covers the full shell, desktop/mobile navigation markup, active route rendering, responsive overflow guard classes, planned disabled controls, and loading/empty/error state labels. `apps/web/tests/dashboard-route-readiness.spec.tsx` verifies active internal dashboard actions point only at implemented route patterns and planned actions stay disabled.

Build the dashboard before release:

```bash
npm run build --workspace @firmcode/web
```

The MVP package does not include a Playwright screenshot runner. Use the Codex in-app browser or a local browser for the route coverage checks above when visual layout changes are made.
