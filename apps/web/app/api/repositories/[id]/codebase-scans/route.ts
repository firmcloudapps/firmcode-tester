import { forwardDashboardApiMutation } from "../../../../../lib/dashboard-api-proxy";

interface CodebaseScansRouteContext {
  params: {
    id: string;
  };
}

export async function POST(_request: Request, context: CodebaseScansRouteContext): Promise<Response> {
  return forwardDashboardApiMutation({
    method: "POST",
    path: `/api/repositories/${encodeURIComponent(context.params.id)}/codebase-scans`
  });
}
