export interface DashboardApiProxyInput {
  readonly method: "GET" | "PATCH" | "POST";
  readonly path: string;
  readonly body?: unknown;
  readonly env?: DashboardProxyEnvironment;
  readonly fetcher?: typeof fetch;
}

const WORKSPACE_HEADER = "x-firmcode-workspace-id";
const USER_HEADER = "x-firmcode-user-id";
const BILLING_CAPABILITY_HEADER = "x-firmcode-clerk-billing-capability";
const AUTHORIZATION_HEADER = "authorization";

type DashboardProxyEnvironment = Record<string, string | undefined>;

export async function forwardDashboardApiMutation(input: DashboardApiProxyInput): Promise<Response> {
  const env = input.env ?? process.env;
  const fetcher = input.fetcher ?? fetch;
  const url = new URL(input.path, getApiBaseUrl(env));
  const headers = await createDashboardApiHeaders(env, input.body !== undefined);

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

export async function createDashboardApiHeaders(env: DashboardProxyEnvironment, hasBody: boolean): Promise<Headers> {
  const headers = new Headers({
    accept: "application/json"
  });
  const token = await readClerkToken(env);

  if (token !== null) {
    headers.set(AUTHORIZATION_HEADER, `Bearer ${token}`);
  }

  if (hasBody) {
    headers.set("content-type", "application/json");
  }

  if (token !== null || env.NODE_ENV === "production") {
    return headers;
  }

  return applyLocalDashboardBypassHeaders(headers, env);
}

export function applyLocalDashboardBypassHeaders(headers: Headers, env: DashboardProxyEnvironment): Headers {
  const workspaceId = env.FIRMCODE_DASHBOARD_WORKSPACE_ID;
  const clerkUserId = env.FIRMCODE_DASHBOARD_CLERK_USER_ID;

  if (workspaceId !== undefined && workspaceId !== "") {
    headers.set(WORKSPACE_HEADER, workspaceId);
  }

  if (clerkUserId !== undefined && clerkUserId !== "") {
    headers.set(USER_HEADER, clerkUserId);
  }

  if (env.FIRMCODE_DASHBOARD_CLERK_BILLING_CAPABILITY !== undefined && env.FIRMCODE_DASHBOARD_CLERK_BILLING_CAPABILITY !== "") {
    headers.set(BILLING_CAPABILITY_HEADER, env.FIRMCODE_DASHBOARD_CLERK_BILLING_CAPABILITY);
  }

  return headers;
}

async function readClerkToken(env: DashboardProxyEnvironment): Promise<string | null> {
  if (env.FIRMCODE_DASHBOARD_CLERK_TOKEN !== undefined && env.FIRMCODE_DASHBOARD_CLERK_TOKEN !== "") {
    return env.FIRMCODE_DASHBOARD_CLERK_TOKEN;
  }

  const { getClerkApiBearerToken } = await import("./clerk-auth");
  return getClerkApiBearerToken(env);
}

function getApiBaseUrl(env: DashboardProxyEnvironment): string {
  return env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}
