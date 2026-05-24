import { forwardDashboardApiMutation } from "../../../../../lib/dashboard-api-proxy";

export async function POST(request: Request): Promise<Response> {
  const body = await readJsonBody(request);

  return forwardDashboardApiMutation({
    method: "POST",
    path: "/api/github/installations/sync",
    body
  });
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
