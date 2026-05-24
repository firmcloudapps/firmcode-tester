import { forwardDashboardApiMutation } from "../../../lib/dashboard-api-proxy";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const repositoryId = url.searchParams.get("repositoryId");
  const path = repositoryId === null ? "/api/rules" : `/api/rules?repositoryId=${encodeURIComponent(repositoryId)}`;

  return forwardDashboardApiMutation({
    method: "GET",
    path
  });
}

export async function PATCH(request: Request): Promise<Response> {
  const body = await readJsonBody(request);

  return forwardDashboardApiMutation({
    method: "PATCH",
    path: "/api/rules",
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
