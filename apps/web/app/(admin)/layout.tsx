import React from "react";
import { requireAdminDashboardAccess } from "../../lib/dashboard-guards";

export const dynamic = "force-dynamic";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  await requireAdminDashboardAccess();
  return <>{children}</>;
}
