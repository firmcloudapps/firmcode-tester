import { forwardDashboardApiMutation } from "../../../../../../lib/dashboard-api-proxy";

interface WorkspaceMemberRouteContext {
  params: {
    userId: string;
  };
}

export async function PATCH(request: Request, context: WorkspaceMemberRouteContext): Promise<Response> {
  const body = await readJsonBody(request);

  return forwardDashboardApiMutation({
    method: "PATCH",
    path: `/api/settings/members/${encodeURIComponent(context.params.userId)}/status`,
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
