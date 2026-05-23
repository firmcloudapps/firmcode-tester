# Task 9.2c Notes

## Dashboard Controls

- Failed review runs expose a retry action in the review run list and detail header.
- Non-failed runs render a disabled retry action. Runs with `invalid_job_payload` show a non-retryable validation message.
- Repository automation is toggled from the repositories table with an accessible switch that optimistically updates and rolls back on failed API responses.
- Next.js dashboard mutation routes proxy retry and repository configuration changes to the Nest API while forwarding the temporary `FIRMCODE_DASHBOARD_WORKSPACE_ID` and `FIRMCODE_DASHBOARD_CLERK_USER_ID` headers.

## Visual Smoke Check

Run these after starting the API and web dashboard:

```bash
npm run dev --workspace @firmcode/web
```

Then inspect these routes at desktop width and a mobile viewport:

```text
http://localhost:3000/review-runs
http://localhost:3000/review-runs/<failed-run-id>
http://localhost:3000/repositories
```

Confirm retry buttons, disabled retry messages, repository switches, pending states, success/error feedback, table overflow, and compact mobile wrapping remain readable.
