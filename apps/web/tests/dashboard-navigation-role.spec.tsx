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
  });

  it("excludes admin-only items for developers", () => {
    const labels = navItemsForRole("developer").map((item) => item.label);

    expect(labels).not.toContain("Settings");
    expect(labels).not.toContain("Billing");
    expect(labels).toContain("Overview");
    expect(labels).toContain("PR Review");
    expect(labels).toContain("Repositories");
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

  it("shows Settings and Billing links in the shell for admins", () => {
    const html = renderToString(
      <DashboardShell activeItem="Overview" role="admin">
        <main>Dashboard body</main>
      </DashboardShell>
    );

    expect(html).toContain('href="/settings"');
    expect(html).toContain('href="/billing"');
  });

  it("falls back to the full menu when no role is provided", () => {
    const html = renderToString(
      <DashboardShell activeItem="Overview">
        <main>Dashboard body</main>
      </DashboardShell>
    );

    expect(html).toContain('href="/settings"');
    expect(html).toContain('href="/billing"');
  });
});
