import { forwardDashboardApiMutation } from "../../../lib/dashboard-api-proxy";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = `/api/pull-requests${url.search}`;

  return forwardDashboardApiMutation({
    method: "GET",
    path
  });
}
