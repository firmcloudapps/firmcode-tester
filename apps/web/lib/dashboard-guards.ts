import { redirect } from "next/navigation";
import { isAdminDashboardRole } from "./dashboard-navigation";
import { loadDashboardRole } from "./dashboard-data";

const SIGN_IN_PATH = "/sign-in";
const DEVELOPER_LANDING_PATH = "/dashboard/developer";

export async function requireAdminDashboardAccess(): Promise<string> {
  const result = await loadDashboardRole();

  if (result.status === "signed-out") {
    redirect(SIGN_IN_PATH);
  }

  if (result.status === "error") {
    redirect(DEVELOPER_LANDING_PATH);
  }

  if (!isAdminDashboardRole(result.role)) {
    redirect(DEVELOPER_LANDING_PATH);
  }

  return result.role;
}
