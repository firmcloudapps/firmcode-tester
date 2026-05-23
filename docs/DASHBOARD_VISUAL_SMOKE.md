# Dashboard Visual Smoke Checks

Use this checklist after dashboard page changes:

```bash
npm run dev --workspace @firmcode/web
```

Then inspect:

- Desktop: `http://localhost:3000/` at 1440px wide.
- Mobile: `http://localhost:3000/` at 390px wide.

For the Overview page, confirm the metric row, Recent Review Runs table, Needs Attention panel, and Review Quality section stay readable, do not overlap, and keep the compact light-mode dashboard styling from `docs/DASHBOARD_DESIGN.md`.

For the Findings page, inspect `http://localhost:3000/findings` on desktop and mobile. Confirm the filter controls wrap cleanly, the findings list scrolls horizontally only inside its bordered surface on small screens, severity/status badges remain readable, and the detail panel content does not overlap links or evidence snippets.
