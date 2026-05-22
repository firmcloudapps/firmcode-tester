export type RuntimeEnvironment = "development" | "test" | "production";

export type EnvironmentVariables = Record<string, string | undefined>;

export interface ConfigValidationIssue {
  variable: string;
  message: string;
}

export class ConfigValidationError extends Error {
  readonly issues: ConfigValidationIssue[];

  constructor(scope: string, issues: ConfigValidationIssue[]) {
    super(`${scope} configuration is invalid: ${issues.map((issue) => `${issue.variable} ${issue.message}`).join("; ")}`);
    this.name = "ConfigValidationError";
    this.issues = issues;
  }
}

export interface DatabaseConfig {
  url: string;
  ssl: boolean;
  redactedUrl: string;
}

export interface DatabaseConnectionSmokeCheck {
  host: string;
  database: string;
  protocol: "postgres" | "postgresql";
  ssl: boolean;
  redactedUrl: string;
}

export interface ClerkWebConfig {
  publishableKey: string;
  billingPortalUrl: string | null;
}

export interface ClerkApiConfig {
  secretKey: string;
  webhookSecret: string | null;
}

export interface ApiRuntimeConfig {
  nodeEnv: RuntimeEnvironment;
  port: number;
  corsAllowedOrigins: string[];
  database: DatabaseConfig;
  clerk: ClerkApiConfig;
}

const BOOLEAN_VALUES = new Map<string, boolean>([
  ["true", true],
  ["1", true],
  ["false", false],
  ["0", false]
]);

export function createApiRuntimeConfig(env: EnvironmentVariables): ApiRuntimeConfig {
  const issues: ConfigValidationIssue[] = [];
  const nodeEnv = readRuntimeEnvironment(env, issues);
  const database = readDatabaseConfig(env, nodeEnv, issues);
  const clerk = readClerkApiConfig(env, issues);
  const port = readPort(env.PORT, 3001, issues);

  if (issues.length > 0 || database === null || clerk === null) {
    throw new ConfigValidationError("API runtime", issues);
  }

  return {
    nodeEnv,
    port,
    corsAllowedOrigins: readList(env.CORS_ALLOWED_ORIGINS),
    database,
    clerk
  };
}

export function createWebClerkConfig(env: EnvironmentVariables): ClerkWebConfig {
  const issues: ConfigValidationIssue[] = [];
  const publishableKey = readRequired(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", issues);
  const billingPortalUrl = readOptionalHttpUrl(env, "CLERK_BILLING_PORTAL_URL", issues);

  if (issues.length > 0 || publishableKey === null) {
    throw new ConfigValidationError("Web Clerk", issues);
  }

  return {
    publishableKey,
    billingPortalUrl
  };
}

export function createDatabaseConnectionSmokeCheck(env: EnvironmentVariables): DatabaseConnectionSmokeCheck {
  const issues: ConfigValidationIssue[] = [];
  const nodeEnv = readRuntimeEnvironment(env, issues);
  const database = readDatabaseConfig(env, nodeEnv, issues);

  if (issues.length > 0 || database === null) {
    throw new ConfigValidationError("Database smoke check", issues);
  }

  const url = new URL(database.url);

  return {
    host: url.hostname,
    database: decodeURIComponent(url.pathname.slice(1)),
    protocol: url.protocol === "postgres:" ? "postgres" : "postgresql",
    ssl: database.ssl,
    redactedUrl: database.redactedUrl
  };
}

export function redactDatabaseUrl(value: string): string {
  const url = new URL(value);

  if (url.password) {
    url.password = "REDACTED";
  }

  return url.toString();
}

function readRuntimeEnvironment(env: EnvironmentVariables, issues: ConfigValidationIssue[]): RuntimeEnvironment {
  const value = readRequired(env, "NODE_ENV", issues);

  if (value === "development" || value === "test" || value === "production") {
    return value;
  }

  if (value !== null) {
    issues.push({
      variable: "NODE_ENV",
      message: "must be development, test, or production"
    });
  }

  return "development";
}

function readDatabaseConfig(
  env: EnvironmentVariables,
  nodeEnv: RuntimeEnvironment,
  issues: ConfigValidationIssue[]
): DatabaseConfig | null {
  const databaseUrl = readRequired(env, "DATABASE_URL", issues);

  if (databaseUrl === null) {
    return null;
  }

  const url = readPostgresUrl(databaseUrl, issues);
  const ssl = readDatabaseSsl(env, nodeEnv, issues);

  if (url === null || ssl === null) {
    return null;
  }

  return {
    url: databaseUrl,
    ssl,
    redactedUrl: redactDatabaseUrl(databaseUrl)
  };
}

function readClerkApiConfig(env: EnvironmentVariables, issues: ConfigValidationIssue[]): ClerkApiConfig | null {
  const secretKey = readRequired(env, "CLERK_SECRET_KEY", issues);

  if (secretKey === null) {
    return null;
  }

  return {
    secretKey,
    webhookSecret: readOptional(env, "CLERK_WEBHOOK_SECRET")
  };
}

function readRequired(env: EnvironmentVariables, variable: string, issues: ConfigValidationIssue[]): string | null {
  const value = env[variable]?.trim();

  if (!value) {
    issues.push({
      variable,
      message: "is required"
    });
    return null;
  }

  return value;
}

function readOptional(env: EnvironmentVariables, variable: string): string | null {
  const value = env[variable]?.trim();
  return value ? value : null;
}

function readOptionalHttpUrl(
  env: EnvironmentVariables,
  variable: string,
  issues: ConfigValidationIssue[]
): string | null {
  const value = readOptional(env, variable);

  if (value === null) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return value;
    }
  } catch {
    // Reported below with a stable message.
  }

  issues.push({
    variable,
    message: "must be an absolute http(s) URL"
  });
  return null;
}

function readPostgresUrl(value: string, issues: ConfigValidationIssue[]): URL | null {
  try {
    const url = new URL(value);
    const hasPostgresProtocol = url.protocol === "postgres:" || url.protocol === "postgresql:";
    const hasDatabaseName = url.pathname.length > 1;

    if (hasPostgresProtocol && url.hostname && hasDatabaseName) {
      return url;
    }
  } catch {
    // Reported below with a stable message.
  }

  issues.push({
    variable: "DATABASE_URL",
    message: "must be a PostgreSQL connection string with a database name"
  });
  return null;
}

function readDatabaseSsl(
  env: EnvironmentVariables,
  nodeEnv: RuntimeEnvironment,
  issues: ConfigValidationIssue[]
): boolean | null {
  const rawValue = env.DATABASE_SSL?.trim().toLowerCase();

  if (!rawValue) {
    if (nodeEnv === "production") {
      issues.push({
        variable: "DATABASE_SSL",
        message: "must be true in production for NeonDB"
      });
      return null;
    }

    return false;
  }

  const parsed = BOOLEAN_VALUES.get(rawValue);

  if (parsed === undefined) {
    issues.push({
      variable: "DATABASE_SSL",
      message: "must be true, false, 1, or 0"
    });
    return null;
  }

  if (nodeEnv === "production" && !parsed) {
    issues.push({
      variable: "DATABASE_SSL",
      message: "must be true in production for NeonDB"
    });
    return null;
  }

  return parsed;
}

function readPort(value: string | undefined, fallback: number, issues: ConfigValidationIssue[]): number {
  if (!value) {
    return fallback;
  }

  const port = Number(value);

  if (Number.isInteger(port) && port > 0 && port <= 65535) {
    return port;
  }

  issues.push({
    variable: "PORT",
    message: "must be an integer from 1 to 65535"
  });
  return fallback;
}

function readList(value: string | undefined): string[] {
  return (
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}
