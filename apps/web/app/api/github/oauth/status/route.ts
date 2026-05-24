import { forwardDashboardApiMutation } from "../../../../../lib/dashboard-api-proxy";

export async function GET(): Promise<Response> {
  return forwardDashboardApiMutation({
    method: "GET",
    path: "/api/github/oauth/status"
  });
}
