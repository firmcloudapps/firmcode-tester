# Debug Session: pr-review-503

- Status: OPEN
- Symptom: Developer PR Review page shows "GitHub status could not be loaded" and "Dashboard API returned 503".
- Expected: PR Review page should render review-run history without surfacing a 503 error.
- Hypotheses:
  - H1: `/api/review-runs` returns 503 in the active environment.
  - H2: The deployed or running app is serving stale code for the developer dashboard route.
  - H3: Dashboard API base URL or auth forwarding breaks requests from the developer page.
  - H4: Review-runs backend dependencies are unhealthy and causing upstream 503s.
  - H5: A page-to-component state contract mismatch is surfacing only at runtime.
- Evidence:
  - Confirmed: shared `PR Review` navigation was still targeting `/github/installations`, which renders the legacy installations view and its old error copy.
  - Confirmed: `/dashboard/developer` had been changed to use a custom shell layout instead of the existing `DashboardShell`.
  - Fixed: `PR Review` route now stays on `/dashboard/developer`, and that page is wrapped by the standard `DashboardShell` rather than a custom layout.
