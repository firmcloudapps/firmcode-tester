import {
  DASHBOARD_APP_ROLES,
  DASHBOARD_CAPABILITIES,
  DASHBOARD_ROLE_CAPABILITY_MATRIX,
  normalizeDashboardAppRole,
  roleHasDashboardCapability,
  type DashboardCapability
} from "../src/modules/auth/dashboard-authorization.policy";

describe("dashboard authorization policy", () => {
  it("defines the MVP Admin and Developer roles explicitly", () => {
    expect(DASHBOARD_APP_ROLES).toEqual(["admin", "developer"]);
  });

  it("limits Admin to workspace administration capabilities", () => {
    const allowed: readonly DashboardCapability[] = [
      "manage_billing",
      "manage_github_installations",
      "manage_sensitive_settings",
      "manage_review_policies"
    ];

    expect(DASHBOARD_ROLE_CAPABILITY_MATRIX.admin).toEqual(allowed);

    for (const capability of DASHBOARD_CAPABILITIES) {
      expect(roleHasDashboardCapability("admin", capability)).toBe(allowed.includes(capability));
    }
  });

  it("limits Developer to implementation and analysis workflows", () => {
    const allowed: readonly DashboardCapability[] = [
      "retry_review_run",
      "trigger_codebase_scan",
      "manage_codebase_scan_findings",
      "manage_repository_configuration",
      "access_raw_artifacts"
    ];

    expect(DASHBOARD_ROLE_CAPABILITY_MATRIX.developer).toEqual(allowed);

    for (const capability of DASHBOARD_CAPABILITIES) {
      expect(roleHasDashboardCapability("developer", capability)).toBe(allowed.includes(capability));
    }
  });

  it("allows external billing capability without broadening the workspace role", () => {
    expect(roleHasDashboardCapability("developer", "manage_billing")).toBe(false);
    expect(roleHasDashboardCapability("developer", "access_raw_artifacts")).toBe(true);
    expect(roleHasDashboardCapability("developer", "manage_billing", { hasBillingCapability: true })).toBe(true);
    expect(roleHasDashboardCapability("developer", "manage_sensitive_settings", { hasBillingCapability: true })).toBe(false);
  });

  it("accepts only the database-owned Admin and Developer roles", () => {
    expect(normalizeDashboardAppRole("owner")).toBeNull();
    expect(normalizeDashboardAppRole("org:owner")).toBeNull();
    expect(normalizeDashboardAppRole("admin")).toBe("admin");
    expect(normalizeDashboardAppRole("member")).toBeNull();
    expect(normalizeDashboardAppRole("developer")).toBe("developer");
    expect(normalizeDashboardAppRole("viewer")).toBeNull();
  });
});
