import type { DashboardRequestContext } from "./dashboard-authorization.service";

export interface DashboardHeaderBag {
  readonly workspaceIdHeader?: string | string[];
  readonly clerkUserIdHeader?: string | string[];
  readonly clerkOrgIdHeader?: string | string[];
}

export function readDashboardRequestContext(headers: DashboardHeaderBag): DashboardRequestContext {
  return {
    workspaceId: readSingleValue(headers.workspaceIdHeader) ?? null,
    clerkUserId: readSingleValue(headers.clerkUserIdHeader) ?? null,
    clerkOrgId: readSingleValue(headers.clerkOrgIdHeader) ?? null
  };
}

export function readSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === "" ? undefined : value;
}
