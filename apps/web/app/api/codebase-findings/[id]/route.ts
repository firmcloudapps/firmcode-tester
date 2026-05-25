import { forwardDashboardApiMutation } from "../../../../lib/dashboard-api-proxy";

interface CodebaseFindingRouteContext {
  params: {
    id: string;
  };
}

export async function PATCH(request: Request, context: CodebaseFindingRouteContext): Promise<Response> {
  const body = await readJsonBody(request);

  return forwardDashboardApiMutation({
    method: "PATCH",
    path: `/api/codebase-findings/${encodeURIComponent(context.params.id)}`,
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
