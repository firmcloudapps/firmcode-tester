# Dashboard Visual Smoke Checks

Use this checklist after dashboard page changes:

```bash
npm run dev --workspace @firmcode/web
```

Then inspect:

- Desktop: `http://localhost:3000/` at 1440px wide.
- Mobile: `http://localhost:3000/` at 390px wide.

For the Overview page, confirm the metric row, Recent Review Runs table, Needs Attention panel, and Review Quality section stay readable, do not overlap, and keep the compact light-mode dashboard styling from `docs/DASHBOARD_DESIGN.md`.
