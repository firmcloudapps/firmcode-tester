import { describe, expect, it } from "vitest";
import {
  DASHBOARD_CAPABILITIES,
  DASHBOARD_ROLE_CAPABILITIES,
  DASHBOARD_WORKSPACE_ROLES,
  canManageSensitiveWorkspaceSettings,
  roleHasDashboardCapability,
  type DashboardCapability,
  type DashboardWorkspaceRole
} from "../../src";

describe("dashboard authorization role policy", () => {
  it("defines capabilities for every workspace role", () => {
    expect(Object.keys(DASHBOARD_ROLE_CAPABILITIES).sort()).toEqual([...DASHBOARD_WORKSPACE_ROLES].sort());

    for (const role of DASHBOARD_WORKSPACE_ROLES) {
      for (const capability of DASHBOARD_ROLE_CAPABILITIES[role]) {
        expect(DASHBOARD_CAPABILITIES).toContain(capability);
      }
    }
  });

  it.each`
    role           | capability                         | allowed
    ${"owner"}     | ${"manage_billing"}                | ${true}
    ${"owner"}     | ${"manage_repository_configuration"} | ${true}
    ${"admin"}     | ${"manage_repository_configuration"} | ${true}
    ${"admin"}     | ${"manage_billing"}                | ${false}
    ${"developer"} | ${"retry_review_run"}              | ${true}
    ${"developer"} | ${"view_raw_artifacts"}            | ${true}
    ${"developer"} | ${"manage_repository_configuration"} | ${false}
    ${"viewer"}    | ${"view_workspace_settings"}       | ${true}
    ${"viewer"}    | ${"view_raw_artifacts"}            | ${false}
    ${"viewer"}    | ${"retry_review_run"}              | ${false}
  `("returns $allowed for $role and $capability", ({ role, capability, allowed }) => {
    expect(roleHasDashboardCapability(role as DashboardWorkspaceRole, capability as DashboardCapability)).toBe(allowed);
  });

  it("keeps sensitive workspace settings limited to owner and admin roles", () => {
    expect(canManageSensitiveWorkspaceSettings("owner")).toBe(true);
    expect(canManageSensitiveWorkspaceSettings("admin")).toBe(true);
    expect(canManageSensitiveWorkspaceSettings("developer")).toBe(false);
    expect(canManageSensitiveWorkspaceSettings("viewer")).toBe(false);
  });
});
