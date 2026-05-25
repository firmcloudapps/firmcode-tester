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

  it("allows Admin to use every dashboard capability", () => {
    for (const capability of DASHBOARD_CAPABILITIES) {
      expect(roleHasDashboardCapability("admin", capability)).toBe(true);
    }
  });

  it("limits Developer to implementation and analysis workflows", () => {
    const allowed: readonly DashboardCapability[] = [
      "retry_review_run",
      "trigger_codebase_scan",
      "manage_codebase_scan_findings",
      "manage_repository_configuration",
      "manage_github_installations"
    ];

    expect(DASHBOARD_ROLE_CAPABILITY_MATRIX.developer).toEqual(allowed);

    for (const capability of DASHBOARD_CAPABILITIES) {
      expect(roleHasDashboardCapability("developer", capability)).toBe(allowed.includes(capability));
    }
  });

  it("allows Clerk-managed billing capability without broadening the workspace role", () => {
    expect(roleHasDashboardCapability("developer", "manage_billing")).toBe(false);
    expect(roleHasDashboardCapability("developer", "access_raw_artifacts")).toBe(false);
    expect(roleHasDashboardCapability("developer", "manage_billing", { hasClerkBillingCapability: true })).toBe(true);
    expect(roleHasDashboardCapability("developer", "manage_sensitive_settings", { hasClerkBillingCapability: true })).toBe(false);
  });

  it("normalizes trusted Clerk and legacy metadata into the simplified role model", () => {
    expect(normalizeDashboardAppRole("owner")).toBe("admin");
    expect(normalizeDashboardAppRole("org:owner")).toBeNull();
    expect(normalizeDashboardAppRole("admin")).toBe("admin");
    expect(normalizeDashboardAppRole("member")).toBe("developer");
    expect(normalizeDashboardAppRole("developer")).toBe("developer");
    expect(normalizeDashboardAppRole("viewer")).toBeNull();
  });
});
