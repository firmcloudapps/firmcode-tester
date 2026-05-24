import { forwardDashboardApiMutation } from "../../../../../lib/dashboard-api-proxy";

interface RepositoryActivityRouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, context: RepositoryActivityRouteContext): Promise<Response> {
  return forwardDashboardApiMutation({
    method: "GET",
    path: `/api/repositories/${encodeURIComponent(context.params.id)}/activity`
  });
}
