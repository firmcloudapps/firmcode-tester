import { forwardDashboardApiMutation } from "../../../../lib/dashboard-api-proxy";

interface RepositoryDetailRouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, context: RepositoryDetailRouteContext): Promise<Response> {
  return forwardDashboardApiMutation({
    method: "GET",
    path: `/api/repositories/${encodeURIComponent(context.params.id)}`
  });
}
