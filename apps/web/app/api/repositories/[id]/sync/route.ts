import { forwardDashboardApiMutation } from "../../../../../lib/dashboard-api-proxy";

interface RepositorySyncRouteContext {
  params: {
    id: string;
  };
}

export async function POST(_request: Request, context: RepositorySyncRouteContext): Promise<Response> {
  return forwardDashboardApiMutation({
    method: "POST",
    path: `/api/repositories/${encodeURIComponent(context.params.id)}/sync`
  });
}
