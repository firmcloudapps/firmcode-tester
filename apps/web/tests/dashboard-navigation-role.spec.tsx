import React from "react";
import { renderToString } from "react-dom/server";
import { DashboardShell } from "../components/dashboard/dashboard-shell";
import { isAdminDashboardRole, navItemsForRole } from "../lib/dashboard-navigation";

describe("role-based dashboard navigation", () => {
  it("treats admin and owner as admin roles", () => {
    expect(isAdminDashboardRole("admin")).toBe(true);
    expect(isAdminDashboardRole("owner")).toBe(true);
    expect(isAdminDashboardRole("ADMIN")).toBe(true);
    expect(isAdminDashboardRole("developer")).toBe(false);
    expect(isAdminDashboardRole("viewer")).toBe(false);
    expect(isAdminDashboardRole(null)).toBe(false);
    expect(isAdminDashboardRole(undefined)).toBe(false);
  });

  it("includes admin-only items for admins", () => {
    const labels = navItemsForRole("admin").map((item) => item.label);

    expect(labels).toContain("Settings");
    expect(labels).toContain("Billing");
    expect(labels).not.toContain("Rules / Policies");
  });

  it("excludes admin-only items for developers", () => {
    const labels = navItemsForRole("developer").map((item) => item.label);

    expect(labels).not.toContain("Settings");
    expect(labels).not.toContain("Billing");
    expect(labels).toContain("Overview");
    expect(labels).toContain("PR Review");
    expect(labels).toContain("Repositories");
    expect(labels).not.toContain("Rules / Policies");
  });

  it("hides Settings and Billing links in the shell for developers", () => {
    const html = renderToString(
      <DashboardShell activeItem="Overview" role="developer">
        <main>Dashboard body</main>
      </DashboardShell>
    );

    expect(html).not.toContain('href="/settings"');
    expect(html).not.toContain('href="/billing"');
    expect(html).toContain('href="/repositories"');
  });

  it("hides company branding in the shell for developers", () => {
    const html = renderToString(
      <DashboardShell activeItem="PR Review" role="developer">
        <main>Dashboard body</main>
      </DashboardShell>
    );

    expect(html).not.toContain(">Company</p>");
    expect(html).not.toContain(">Firmcode</p>");
    expect(html).not.toContain(">Connect GitHub</a>");
    expect(html).toContain(">Workspace</p>");
  });

  it("shows Settings and Billing links in the shell for admins", () => {
    const html = renderToString(
      <DashboardShell activeItem="Overview" role="admin">
        <main>Dashboard body</main>
      </DashboardShell>
    );

    expect(html).toContain('href="/settings"');
    expect(html).toContain('href="/billing"');
  });

  it("falls back to the developer menu when no role is provided", () => {
    const html = renderToString(
      <DashboardShell activeItem="Overview">
        <main>Dashboard body</main>
      </DashboardShell>
    );

    expect(html).not.toContain('href="/settings"');
    expect(html).not.toContain('href="/billing"');
    expect(html).toContain('href="/rules"');
  });
});
