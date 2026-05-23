export interface DashboardApiProxyInput {
  readonly method: "PATCH" | "POST";
  readonly path: string;
  readonly body?: unknown;
  readonly env?: DashboardProxyEnvironment;
  readonly fetcher?: typeof fetch;
}

const WORKSPACE_HEADER = "x-firmcode-workspace-id";
const USER_HEADER = "x-firmcode-user-id";

type DashboardProxyEnvironment = Record<string, string | undefined>;

export async function forwardDashboardApiMutation(input: DashboardApiProxyInput): Promise<Response> {
  const env = input.env ?? process.env;
  const fetcher = input.fetcher ?? fetch;
  const url = new URL(input.path, getApiBaseUrl(env));
  const headers = createDashboardApiHeaders(env, input.body !== undefined);

  const response = await fetcher(url, {
    method: input.method,
    headers,
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    cache: "no-store"
  });
  const responseBody = await response.text();
  const responseHeaders = new Headers();
  const contentType = response.headers.get("content-type");

  if (contentType !== null) {
    responseHeaders.set("content-type", contentType);
  }

  return new Response(responseBody, {
    status: response.status,
    headers: responseHeaders
  });
}

export function createDashboardApiHeaders(env: DashboardProxyEnvironment, hasBody: boolean): Headers {
  const headers = new Headers({
    accept: "application/json"
  });
  const workspaceId = env.FIRMCODE_DASHBOARD_WORKSPACE_ID;
  const clerkUserId = env.FIRMCODE_DASHBOARD_CLERK_USER_ID;

  if (hasBody) {
    headers.set("content-type", "application/json");
  }

  if (workspaceId !== undefined && workspaceId !== "") {
    headers.set(WORKSPACE_HEADER, workspaceId);
  }

  if (clerkUserId !== undefined && clerkUserId !== "") {
    headers.set(USER_HEADER, clerkUserId);
  }

  return headers;
}

function getApiBaseUrl(env: DashboardProxyEnvironment): string {
  return env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}
