export const DASHBOARD_APP_ROLES = ["admin", "developer"] as const;

export type DashboardAppRole = (typeof DASHBOARD_APP_ROLES)[number];

export type DashboardRole = DashboardAppRole | "owner" | "viewer";

export const DASHBOARD_CAPABILITIES = [
  "retry_review_run",
  "trigger_codebase_scan",
  "manage_codebase_scan_findings",
  "manage_repository_configuration",
  "manage_review_policies",
  "manage_sensitive_settings",
  "access_raw_artifacts",
  "manage_billing",
  "manage_github_installations"
] as const;

export type DashboardCapability = (typeof DASHBOARD_CAPABILITIES)[number];

export const DASHBOARD_ROLE_CAPABILITY_MATRIX: Readonly<Record<DashboardAppRole, readonly DashboardCapability[]>> = {
  admin: DASHBOARD_CAPABILITIES,
  developer: [
    "retry_review_run",
    "trigger_codebase_scan",
    "manage_repository_configuration",
    "access_raw_artifacts"
  ]
} as const;

export function roleHasDashboardCapability(
  role: DashboardRole,
  capability: DashboardCapability,
  options: { hasClerkBillingCapability?: boolean } = {}
): boolean {
  const appRole = normalizeDashboardAppRole(role);

  if (capability === "manage_billing" && options.hasClerkBillingCapability === true) {
    return true;
  }

  if (appRole === null) {
    return false;
  }

  return DASHBOARD_ROLE_CAPABILITY_MATRIX[appRole].includes(capability);
}

export function normalizeDashboardAppRole(role: string | null | undefined): DashboardAppRole | null {
  switch (role?.toLowerCase()) {
    case "owner":
    case "admin":
      return "admin";
    case "developer":
    case "member":
      return "developer";
    default:
      return null;
  }
}

export function hasClerkManagedBillingCapability(value: string | string[] | undefined): boolean {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (candidate === undefined || candidate === "") {
    return false;
  }

  return ["manage_billing", "billing_admin", "org:billing:manage", "true"].includes(candidate);
}
