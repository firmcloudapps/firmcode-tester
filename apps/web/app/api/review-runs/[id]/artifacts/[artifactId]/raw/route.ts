import { forwardDashboardApiMutation } from "../../../../../../../lib/dashboard-api-proxy";

interface RawArtifactRouteContext {
  params: {
    id: string;
    artifactId: string;
  };
}

export async function GET(_request: Request, context: RawArtifactRouteContext): Promise<Response> {
  return forwardDashboardApiMutation({
    method: "GET",
    path: `/api/review-runs/${encodeURIComponent(context.params.id)}/artifacts/${encodeURIComponent(context.params.artifactId)}/raw`
  });
}
