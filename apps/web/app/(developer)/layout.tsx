import React from "react";
import { requireDeveloperDashboardAccess } from "../../lib/dashboard-guards";

export const dynamic = "force-dynamic";

interface DeveloperLayoutProps {
  children: React.ReactNode;
}

export default async function DeveloperLayout({ children }: DeveloperLayoutProps) {
  await requireDeveloperDashboardAccess();
  return <>{children}</>;
}
