import { forwardDashboardApiMutation } from "../../../../lib/dashboard-api-proxy";

interface PullRequestDetailRouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, context: PullRequestDetailRouteContext): Promise<Response> {
  return forwardDashboardApiMutation({
    method: "GET",
    path: `/api/pull-requests/${encodeURIComponent(context.params.id)}`
  });
}
