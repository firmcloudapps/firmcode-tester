import { forwardDashboardApiMutation } from "../../../../../lib/dashboard-api-proxy";

interface RepositoryConfigurationRouteContext {
  params: {
    id: string;
  };
}

export async function PATCH(request: Request, context: RepositoryConfigurationRouteContext): Promise<Response> {
  const body = await readJsonBody(request);

  return forwardDashboardApiMutation({
    method: "PATCH",
    path: `/api/repositories/${encodeURIComponent(context.params.id)}/configuration`,
    body
  });
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
