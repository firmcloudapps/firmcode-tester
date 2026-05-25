export interface DashboardApiProxyInput {
  readonly method: "GET" | "PATCH" | "POST";
  readonly path: string;
  readonly body?: unknown;
  readonly env?: DashboardProxyEnvironment;
  readonly fetcher?: typeof fetch;
}

const WORKSPACE_HEADER = "x-firmcode-workspace-id";
const AUTHORIZATION_HEADER = "authorization";
const TEST_SESSION_TOKEN_ENV = "FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN";
const TEST_WORKSPACE_ID_ENV = "FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID";

type DashboardProxyEnvironment = Record<string, string | undefined>;

export async function forwardDashboardApiMutation(input: DashboardApiProxyInput): Promise<Response> {
  const env = input.env ?? process.env;
  const fetcher = input.fetcher ?? fetch;
  const url = new URL(input.path, getApiBaseUrl(env));
  const headers = await createDashboardApiHeaders(env, input.body !== undefined);

  if (headers === null) {
    return createUnauthenticatedDashboardResponse();
  }

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

export async function createDashboardApiHeaders(env: DashboardProxyEnvironment, hasBody: boolean): Promise<Headers | null> {
  const headers = new Headers({
    accept: "application/json"
  });
  const token = await readClerkToken(env);

  if (token === null) {
    return null;
  }

  headers.set(AUTHORIZATION_HEADER, `Bearer ${token}`);

  if (hasBody) {
    headers.set("content-type", "application/json");
  }

  const workspaceId = env.NODE_ENV === "production" ? undefined : env[TEST_WORKSPACE_ID_ENV];
  if (workspaceId !== undefined && workspaceId.trim() !== "") {
    headers.set(WORKSPACE_HEADER, workspaceId);
  }

  return headers;
}

async function readClerkToken(env: DashboardProxyEnvironment): Promise<string | null> {
  const testToken = env[TEST_SESSION_TOKEN_ENV];

  if (env.NODE_ENV !== "production" && testToken !== undefined && testToken.trim() !== "") {
    return testToken;
  }

  const { getClerkApiBearerToken } = await import("./clerk-auth");
  return getClerkApiBearerToken(env);
}

function createUnauthenticatedDashboardResponse(): Response {
  return new Response(JSON.stringify({ message: "A signed-in Clerk session is required." }), {
    status: 401,
    headers: {
      "content-type": "application/json"
    }
  });
}

function getApiBaseUrl(env: DashboardProxyEnvironment): string {
  return env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}
