# Vercel Dashboard Deployment

Firmcode uses Vercel only for the Next.js dashboard in `apps/web`. The dashboard does not receive GitHub webhooks, run queues, run Semgrep, or connect directly to Redis. It renders the product UI, handles InsForge frontend flows, and calls the Coolify API through `NEXT_PUBLIC_API_URL`.

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
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | web | InsForge publishable key for the matching InsForge environment. |
| `INSFORGE_SERVICE_KEY` | web server | Required only for server-side InsForge calls in the dashboard. Keep it secret. |
| `INSFORGE_BASE_URL` | web server | InsForge token audience/template used when sending bearer tokens to the Coolify API. |
| `NEXT_PUBLIC_INSFORGE_SIGN_IN_URL` | web | Sign-in route, normally `/sign-in`. |
| `NEXT_PUBLIC_INSFORGE_SIGN_UP_URL` | web | Sign-up route, normally `/sign-up`. |
| `NEXT_PUBLIC_INSFORGE_AFTER_SIGN_IN_URL` | web | Post sign-in fallback destination, normally `/auth/redirect` for role-based dashboard routing. |
| `NEXT_PUBLIC_INSFORGE_AFTER_SIGN_UP_URL` | web | Post sign-up fallback destination, normally `/auth/redirect` for role-based dashboard routing. |
| `INSFORGE_BILLING_PORTAL_URL` | web | InsForge-managed billing portal or account billing URL. |
| `FIRMCODE_DEFAULT_WORKSPACE_ID` | web server | InsForge organization to add signups to, currently `org_3EGsxXDTl8pWEfV6da6oENrYhRr`. |
| `FIRMCODE_DEFAULT_WORKSPACE_NAME` | web server | Display name used by backend workspace repair, currently `Firmcode AI`. |
| `FIRMCODE_DEFAULT_WORKSPACE_ROLE` | web server | InsForge membership role for first-time signup assignment, normally `org:developer`. |
| `VERCEL_URL` | Vercel | Auto-provided by Vercel and useful for preview callback handling. |

Do not set GitHub App private keys, LLM API keys, Redis URLs, or worker-only settings in Vercel unless a future dashboard server route explicitly needs them.

Do not set or rely on `FIRMCODE_DASHBOARD_WORKSPACE_ID` or `FIRMCODE_DASHBOARD_USER_ID` in production Vercel deployments. The dashboard must authenticate with InsForge auth checks and send InsForge bearer tokens to the API.

## CORS Coordination

Every Vercel origin that calls the API must be listed in the Coolify API `CORS_ALLOWED_ORIGINS` value:

```text
CORS_ALLOWED_ORIGINS=https://firmcode.firmoncloud.com,https://firmcode-git-main-owner.vercel.app,http://localhost:3000
```

Use explicit origins in production. Do not use wildcard CORS because dashboard requests carry authenticated InsForge context.

## InsForge URLs

Configure InsForge with:

- Production dashboard URL in allowed redirect and callback URLs.
- Sign-in URL: `https://firmcode.firmoncloud.com/sign-in`.
- Sign-up URL: `https://firmcode.firmoncloud.com/sign-up`.
- After sign-in and after sign-up URL: `https://firmcode.firmoncloud.com/auth/redirect`.
- Webhook endpoint: `https://firmcodeapi.firmoncloud.com/webhooks/insforge` subscribed to `user.created`.
- GitHub App OAuth callback URL: `https://firmcode.firmoncloud.com/api/auth/github/callback`.
- GitHub App setup URL: `https://firmcode.firmoncloud.com/github/installations/callback`; enable Redirect on update in the GitHub App settings.
- Vercel preview URL pattern if preview deployments need authenticated dashboard access.
- API token audience/template matching `INSFORGE_BASE_URL`.
- Billing portal URL exposed through `INSFORGE_BILLING_PORTAL_URL`.

The Coolify API validates InsForge tokens for dashboard API calls; the dashboard should not bypass the API to read private application state.

## Deployment Order

Deploy Vercel after the backend dependencies are reachable:

1. Provision NeonDB.
2. Provision InsForge.
3. Provision Redis or managed Redis.
4. Deploy the Coolify API.
5. Run database migrations from the Coolify API service.
6. Deploy the Coolify worker.
7. Deploy the Vercel dashboard.
8. Add the Vercel production and preview origins to Coolify API `CORS_ALLOWED_ORIGINS`.
9. Verify InsForge sign-in and dashboard API calls.

This order keeps the dashboard from deploying with a public API URL that is not yet healthy.

## Smoke Checks

Run these checks before enabling real GitHub publishing:

- Vercel build succeeds for `apps/web`.
- Dashboard loads at the production URL.
- InsForge sign-in completes.
- Unauthenticated dashboard access redirects to `/sign-in`.
- The dashboard shell shows InsForge account controls.
- Dashboard requests reach the Coolify API through `NEXT_PUBLIC_API_URL`.
- Dashboard API requests include a InsForge bearer token.
- GitHub OAuth start/callback routes require the signed-in InsForge browser session and redirect to `/sign-in` when it is missing.
- Billing management is visible only to Admins or users whose InsForge token includes the billing management capability.
- No production dashboard path depends on `FIRMCODE_DASHBOARD_*` or `x-firmcode-user-id`.
- Coolify API CORS allows the Vercel production origin.
- Preview deployment can call the API if preview deployments are enabled.

## Rollback Notes

Use Vercel's previous deployment promotion to roll back dashboard regressions. A dashboard rollback should not require API or worker rollback unless the deployed UI depends on an incompatible API contract. If a backend rollback changes API behavior, update `NEXT_PUBLIC_API_URL` only when moving traffic to a different API host.

Keep failed preview deployments isolated from production by requiring separate InsForge preview URLs and explicit CORS origins.

## Local Mapping

Local development maps to Vercel like this:

| Local | Vercel |
| --- | --- |
| `npm run dev --workspace @firmcode/web` | Vercel Next.js runtime |
| `NEXT_PUBLIC_API_URL=http://localhost:3001` | `NEXT_PUBLIC_API_URL=https://firmcodeapi.firmoncloud.com` |
| `APP_URL=http://localhost:3000` | `APP_URL=https://firmcode.example.com` |
| Local InsForge development keys | InsForge production or preview keys |

The local Docker Compose stack does not run the web service. It runs only the services that map to Coolify: API, worker, and Redis.
