# Dashboard Visual Navigation QA - 2026-05-25

Task: 9.8b Dashboard Visual Navigation QA.

## Commands Run

```bash
npm run test --workspace @firmcode/web
npm run lint --workspace @firmcode/web
npm run build --workspace @firmcode/web
```

All three commands passed.

The local dashboard server command was:

```bash
npm run dev --workspace @firmcode/web
```

The first sandboxed attempt failed with:

```text
Error: listen EPERM: operation not permitted 0.0.0.0:3000
```

The approved local server run succeeded. Ports 3000 and 3001 were already in use, so Next.js served the dashboard at:

```text
http://localhost:3002
```

## Browser Smoke

Browser smoke covered desktop `1440x900` and mobile `390x844` for:

- `/`
- `/github/installations`
- `/repositories`
- `/pull-requests`
- `/review-runs`
- `/findings`
- `/ci-failures`
- `/rules`
- `/settings`
- `/billing`

Checks performed:

- Dashboard shell rendered with Clerk-authenticated scaffold.
- Active sidebar/mobile navigation state was present for each route.
- No route rendered a framework 404 page.
- No body-level horizontal overflow was detected at desktop or mobile widths.
- External dashboard links were marked with `data-dashboard-destination`.
- Planned controls rendered disabled states.

Notes:

- `/rules` rendered the dashboard error state, `Rules / Policies could not be loaded`, because the local backend response was unavailable.
- `/billing` rendered a disabled billing-management error state because local billing status/configuration was unavailable.
- Both states remained inside the dashboard shell and did not render a 404.
