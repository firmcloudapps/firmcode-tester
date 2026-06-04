import React from "react";
import { ensureAuthenticatedUserDefaultClerkOrganizationMembership } from "../../lib/default-clerk-organization";

export const dynamic = "force-dynamic";

interface DeveloperLayoutProps {
  children: React.ReactNode;
}

export default async function DeveloperLayout({ children }: DeveloperLayoutProps) {
  if (process.env.NODE_ENV !== "test") {
    await ensureAuthenticatedUserDefaultClerkOrganizationMembership();
  }
  return <>{children}</>;
}
