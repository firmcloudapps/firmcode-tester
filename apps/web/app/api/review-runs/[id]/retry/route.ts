import { forwardDashboardApiMutation } from "../../../../../lib/dashboard-api-proxy";

interface RetryRouteContext {
  params: {
    id: string;
  };
}

export async function POST(_request: Request, context: RetryRouteContext): Promise<Response> {
  return forwardDashboardApiMutation({
    method: "POST",
    path: `/api/review-runs/${encodeURIComponent(context.params.id)}/retry`
  });
}
