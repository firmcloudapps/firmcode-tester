import React from "react";
import { ensureAuthenticatedUserDefaultClerkOrganizationMembership } from "../../lib/default-clerk-organization";

export const dynamic = "force-dynamic";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  if (process.env.NODE_ENV !== "test") {
    await ensureAuthenticatedUserDefaultClerkOrganizationMembership();
  }

  return <>{children}</>;
}
