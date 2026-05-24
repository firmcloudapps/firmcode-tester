# Task 9.4a Notes

## Authorization Foundation

- Dashboard role capabilities are defined in `packages/shared/src/auth/dashboard-authorization.ts`.
- The API authorization foundation lives in `apps/api/src/modules/auth`.
- `DashboardAuthorizationService` resolves the Clerk user, Firmcode workspace, optional Clerk organization mapping, active membership, and role before endpoint services perform resource-specific work.
- `DashboardAuthModule` centralizes the membership store provider so dashboard modules do not each create their own authorization provider.

## Representative Integrations

- `GET /api/settings` uses the shared authorization service for workspace settings context and supports resolving the workspace by `x-firmcode-workspace-id` or `x-firmcode-clerk-org-id`.
- `GET/PATCH /api/repositories/:id/configuration` and `POST /api/review-runs/:id/retry` use the service with capability checks and conceal membership failures as `404` so cross-workspace resource existence is not leaked.

## Verification

Validated with the documented local command:

```bash
npm run test
```
