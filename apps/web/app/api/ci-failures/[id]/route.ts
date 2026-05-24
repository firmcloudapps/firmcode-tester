import { forwardDashboardApiMutation } from "../../../../lib/dashboard-api-proxy";

export async function GET(_request: Request, context: { params: { id: string } }): Promise<Response> {
  return forwardDashboardApiMutation({
    method: "GET",
    path: `/api/ci-failures/${encodeURIComponent(context.params.id)}`
  });
}
