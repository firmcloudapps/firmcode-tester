import { loadWebInsForgeAuthRenderConfig } from "../config/insforge";

const TEST_SESSION_TOKEN_ENV = "FIRMCODE_TEST_DASHBOARD_SESSION_TOKEN";

export interface DashboardAuthSession {
  readonly accessToken: string;
  readonly userId: string;
  readonly email: string | null;
}

export async function getDashboardApiBearerToken(
  env: Record<string, string | undefined> = process.env
): Promise<string | null> {
  const session = await getServerDashboardAuthSession(env);
  return session?.accessToken ?? null;
}

export async function getServerDashboardAuthSession(
  env: Record<string, string | undefined> = process.env
): Promise<DashboardAuthSession | null> {
  const testToken = readTestSessionToken(env);

  if (env.NODE_ENV !== "production" && testToken !== null) {
    return {
      accessToken: testToken,
      userId: "test-user",
      email: null
    };
  }

  try {
    const [{ cookies }, { DEFAULT_ACCESS_TOKEN_COOKIE, createServerClient }] = await Promise.all([
      import("next/headers"),
      import("@insforge/sdk/ssr")
    ]);
    const cookieStore = cookies();
    const accessToken = cookieStore.get(DEFAULT_ACCESS_TOKEN_COOKIE)?.value?.trim();

    if (!accessToken) {
      return null;
    }

    const { baseUrl, anonKey } = loadWebInsForgeAuthRenderConfig(env);
    const client = createServerClient({
      baseUrl,
      anonKey,
      cookies: cookieStore,
      accessToken
    });
    const { data, error } = await client.auth.getCurrentUser();

    if (error !== null || data?.user == null) {
      return null;
    }

    return {
      accessToken,
      userId: data.user.id,
      email: readUserEmail(data.user)
    };
  } catch {
    return null;
  }
}

function readTestSessionToken(env: Record<string, string | undefined>): string | null {
  const token = env[TEST_SESSION_TOKEN_ENV];
  return token === undefined || token.trim() === "" ? null : token;
}

function readUserEmail(user: { email?: string | null }): string | null {
  return typeof user.email === "string" && user.email.trim() !== "" ? user.email : null;
}
