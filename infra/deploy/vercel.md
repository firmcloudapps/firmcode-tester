# Vercel Dashboard Deployment

Firmcode uses Vercel only for the Next.js dashboard in `apps/web`. The dashboard does not receive GitHub webhooks, run queues, run Semgrep, or connect directly to Redis. It renders the product UI, handles Clerk frontend flows, and calls the Coolify API through `NEXT_PUBLIC_API_URL`.

## Service Shape

| Setting | Value |
| --- | --- |
| Service | Next.js dashboard |
| Source path | `apps/web` |
| Runtime | Vercel managed Next.js |
| Public URL | `APP_URL`, for example `https://firmcode.example.com` |
| API dependency | Coolify API through `NEXT_PUBLIC_API_URL` |
| Database dependency | None directly |
| Redis dependency | None directly |
| Health check | Vercel deployment status plus dashboard load check |

## Build Configuration

Recommended Vercel project configuration:

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| Root directory | `apps/web` |
| Install command | Use Vercel default if workspace packages resolve; otherwise `cd ../.. && npm ci` |
| Build command | Use Vercel default if workspace packages resolve; otherwise `cd ../.. && npm run build --workspace @firmcode/shared && npm run build --workspace @firmcode/web` |
| Output directory | `.next` when the project root is `apps/web`; `apps/web/.next` when building from repo root |

The web app imports `@firmcode/shared`, so Vercel must install with enough monorepo context to resolve workspace packages. If a deployment cannot resolve `@firmcode/shared`, keep the Vercel project attached to `apps/web` but override install and build commands to run from the repository root as shown above.

## Environment Variables

Set these variables in Vercel for Production, Preview, and Development as appropriate:

| Variable | Scope | Notes |
| --- | --- | --- |
| `NODE_ENV` | Vercel | Usually managed by Vercel. |
| `APP_URL` | web | Production dashboard URL, for example `https://firmcode.firmoncloud.com`. Preview deployments can use `https://${VERCEL_URL}` where supported. |
| `NEXT_PUBLIC_DASHBOARD_URL` | web | Public dashboard URL used after OAuth callback redirects. Usually the same value as `APP_URL`. |
| `NEXT_PUBLIC_API_URL` | web | Public Coolify API URL, `https://firmcodeapi.firmoncloud.com`. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | web | Clerk publishable key for the matching Clerk environment. |
| `CLERK_SECRET_KEY` | web server | Required only for server-side Clerk calls in the dashboard. Keep it secret. |
| `CLERK_JWT_AUDIENCE` | web server | Clerk token audience/template used when sending bearer tokens to the Coolify API. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | web | Sign-in route, normally `/sign-in`. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | web | Sign-up route, normally `/sign-up`. |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | web | Post sign-in fallback destination, normally `/auth/redirect` for role-based dashboard routing. |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | web | Post sign-up fallback destination, normally `/auth/redirect` for role-based dashboard routing. |
| `CLERK_BILLING_PORTAL_URL` | web | Clerk-managed billing portal or account billing URL. |
| `VERCEL_URL` | Vercel | Auto-provided by Vercel and useful for preview callback handling. |

Do not set GitHub App private keys, LLM API keys, Redis URLs, or worker-only settings in Vercel unless a future dashboard server route explicitly needs them.

Do not set or rely on `FIRMCODE_DASHBOARD_WORKSPACE_ID` or `FIRMCODE_DASHBOARD_CLERK_USER_ID` in production Vercel deployments. The dashboard must authenticate with Clerk middleware and send Clerk bearer tokens to the API.

## CORS Coordination

Every Vercel origin that calls the API must be listed in the Coolify API `CORS_ALLOWED_ORIGINS` value:

```text
CORS_ALLOWED_ORIGINS=https://firmcode.firmoncloud.com,https://firmcode-git-main-owner.vercel.app,http://localhost:3000
```

Use explicit origins in production. Do not use wildcard CORS because dashboard requests carry authenticated Clerk context.

## Clerk URLs

Configure Clerk with:

- Production dashboard URL in allowed redirect and callback URLs.
- Sign-in URL: `https://firmcode.firmoncloud.com/sign-in`.
- Sign-up URL: `https://firmcode.firmoncloud.com/sign-up`.
- After sign-in and after sign-up URL: `https://firmcode.firmoncloud.com/auth/redirect`.
- GitHub App OAuth callback URL: `https://firmcode.firmoncloud.com/api/auth/github/callback`.
- GitHub App setup URL: `https://firmcode.firmoncloud.com/github/installations/callback`; enable Redirect on update in the GitHub App settings.
- Vercel preview URL pattern if preview deployments need authenticated dashboard access.
- API token audience/template matching `CLERK_JWT_AUDIENCE`.
- Billing portal URL exposed through `CLERK_BILLING_PORTAL_URL`.

The Coolify API validates Clerk tokens for dashboard API calls; the dashboard should not bypass the API to read private application state.

## Deployment Order

Deploy Vercel after the backend dependencies are reachable:

1. Provision NeonDB.
2. Provision Clerk.
3. Provision Redis or managed Redis.
4. Deploy the Coolify API.
5. Run database migrations from the Coolify API service.
6. Deploy the Coolify worker.
7. Deploy the Vercel dashboard.
8. Add the Vercel production and preview origins to Coolify API `CORS_ALLOWED_ORIGINS`.
9. Verify Clerk sign-in and dashboard API calls.

This order keeps the dashboard from deploying with a public API URL that is not yet healthy.

## Smoke Checks

Run these checks before enabling real GitHub publishing:

- Vercel build succeeds for `apps/web`.
- Dashboard loads at the production URL.
- Clerk sign-in completes.
- Unauthenticated dashboard access redirects to `/sign-in`.
- The dashboard shell shows Clerk account controls.
- Dashboard requests reach the Coolify API through `NEXT_PUBLIC_API_URL`.
- Dashboard API requests include a Clerk bearer token.
- GitHub OAuth start/callback routes require the signed-in Clerk browser session and redirect to `/sign-in` when it is missing.
- Billing management is visible only to Admins or users whose Clerk token includes the billing management capability.
- No production dashboard path depends on `FIRMCODE_DASHBOARD_*` or `x-firmcode-user-id`.
- Coolify API CORS allows the Vercel production origin.
- Preview deployment can call the API if preview deployments are enabled.

## Rollback Notes

Use Vercel's previous deployment promotion to roll back dashboard regressions. A dashboard rollback should not require API or worker rollback unless the deployed UI depends on an incompatible API contract. If a backend rollback changes API behavior, update `NEXT_PUBLIC_API_URL` only when moving traffic to a different API host.

Keep failed preview deployments isolated from production by requiring separate Clerk preview URLs and explicit CORS origins.

## Local Mapping

Local development maps to Vercel like this:

| Local | Vercel |
| --- | --- |
| `npm run dev --workspace @firmcode/web` | Vercel Next.js runtime |
| `NEXT_PUBLIC_API_URL=http://localhost:3001` | `NEXT_PUBLIC_API_URL=https://firmcodeapi.firmoncloud.com` |
| `APP_URL=http://localhost:3000` | `APP_URL=https://firmcode.example.com` |
| Local Clerk development keys | Clerk production or preview keys |

The local Docker Compose stack does not run the web service. It runs only the services that map to Coolify: API, worker, and Redis.
