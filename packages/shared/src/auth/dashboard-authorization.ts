export const DASHBOARD_WORKSPACE_ROLES = ["owner", "admin", "developer", "viewer"] as const;

export type DashboardWorkspaceRole = (typeof DASHBOARD_WORKSPACE_ROLES)[number];

export const DASHBOARD_CAPABILITIES = [
  "view_dashboard",
  "view_workspace_settings",
  "manage_billing",
  "manage_members",
  "manage_github_installations",
  "manage_repository_configuration",
  "manage_review_policies",
  "manage_retention",
  "retry_review_run",
  "view_raw_artifacts"
] as const;

export type DashboardCapability = (typeof DASHBOARD_CAPABILITIES)[number];

export const DASHBOARD_ROLE_CAPABILITIES: Readonly<Record<DashboardWorkspaceRole, readonly DashboardCapability[]>> = {
  owner: DASHBOARD_CAPABILITIES,
  admin: [
    "view_dashboard",
    "view_workspace_settings",
    "manage_members",
    "manage_github_installations",
    "manage_repository_configuration",
    "manage_review_policies",
    "manage_retention",
    "retry_review_run",
    "view_raw_artifacts"
  ],
  developer: ["view_dashboard", "view_workspace_settings", "retry_review_run", "view_raw_artifacts"],
  viewer: ["view_dashboard", "view_workspace_settings"]
} as const;

export function roleHasDashboardCapability(role: DashboardWorkspaceRole, capability: DashboardCapability): boolean {
  return DASHBOARD_ROLE_CAPABILITIES[role].includes(capability);
}

export function canManageSensitiveWorkspaceSettings(role: DashboardWorkspaceRole): boolean {
  return (
    roleHasDashboardCapability(role, "manage_github_installations") &&
    roleHasDashboardCapability(role, "manage_review_policies") &&
    roleHasDashboardCapability(role, "manage_retention")
  );
}
