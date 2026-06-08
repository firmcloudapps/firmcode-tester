import type { WorkspaceSettingsResponse } from "@firmcode/shared";
import { createDashboardApiHeaders, getDashboardApiBaseUrl } from "./dashboard-api-proxy";

export const ROLE_BASED_AUTH_REDIRECT_PATH = "/auth/redirect";

type RoleBasedDashboardPath = "/dashboard/admin" | "/dashboard/developer";

interface RoleBasedDashboardRedirectInput {
  readonly requestUrl: string;
  readonly env?: Record<string, string | undefined>;
  readonly fetcher?: typeof fetch;
}

export async function resolveRoleBasedDashboardRedirect({
  requestUrl,
  env = process.env,
  fetcher = fetch
}: RoleBasedDashboardRedirectInput): Promise<URL> {
  const requestBaseUrl = new URL(requestUrl);
  const headers = await createDashboardApiHeaders(env, false);

  if (headers === null) {
    return new URL("/sign-in", requestBaseUrl);
  }

  try {
    const response = await fetcher(new URL("/api/settings", getApiBaseUrl(env)), {
      cache: "no-store",
      headers
    });

    if (response.status === 401) {
      return new URL("/sign-in", requestBaseUrl);
    }

    if (!response.ok) {
      return new URL("/dashboard", requestBaseUrl);
    }

    const settings = (await response.json()) as Partial<WorkspaceSettingsResponse>;

    return new URL(landingPathForDashboardRole(settings.workspace?.role), requestBaseUrl);
  } catch {
    return new URL("/dashboard", requestBaseUrl);
  }
}

export function landingPathForDashboardRole(role: string | null | undefined): RoleBasedDashboardPath {
  switch (role?.toLowerCase()) {
    case "admin":
    case "owner":
      return "/dashboard/admin";
    case "developer":
    case "member":
    default:
      return "/dashboard/developer";
  }
}

function getApiBaseUrl(env: Record<string, string | undefined>): string {
  return getDashboardApiBaseUrl(env);
}
