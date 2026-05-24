import {
  DEFAULT_LARGE_PULL_REQUEST_THRESHOLDS,
  type LargePullRequestThresholds
} from "../review/large-pr-handling";

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

export interface QueueConfig {
  redisUrl: string;
  redactedRedisUrl: string;
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

export interface RedactedGitHubAppConfig {
  appId: "REDACTED";
  privateKey: "REDACTED";
  webhookSecret: "REDACTED";
  clientId: "REDACTED";
  clientSecret: "REDACTED";
}

export interface GitHubAppConfig {
  readonly appId: number;
  readonly privateKey: string;
  readonly webhookSecret: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redacted: RedactedGitHubAppConfig;
  toJSON(): RedactedGitHubAppConfig;
}

export interface ApiRuntimeConfig {
  nodeEnv: RuntimeEnvironment;
  port: number;
  corsAllowedOrigins: string[];
  database: DatabaseConfig;
  queue: QueueConfig;
  clerk: ClerkApiConfig;
  github: GitHubAppConfig | null;
  review: ReviewConfig;
}

export interface ReviewConfig {
  dryRun: boolean;
  skipDraftPullRequests: boolean;
  ciLogMaxBytes: number;
  artifactRetentionDays: number;
  largePullRequest: LargePullRequestThresholds;
}

export const DEFAULT_CI_LOG_MAX_BYTES = 20_000;

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
  const queue = readQueueConfig(env, issues);
  const clerk = readClerkApiConfig(env, issues);
  const github = readGitHubAppConfig(env, nodeEnv, issues);
  const review = readReviewConfig(env, issues);
  const port = readPort(env.PORT, 3001, issues);

  if (issues.length > 0 || database === null || queue === null || clerk === null) {
    throw new ConfigValidationError("API runtime", issues);
  }

  return {
    nodeEnv,
    port,
    corsAllowedOrigins: readList(env.CORS_ALLOWED_ORIGINS),
    database,
    queue,
    clerk,
    github,
    review
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
  return redactUrlPassword(value);
}

export function redactRedisUrl(value: string): string {
  return redactUrlPassword(value);
}

export function normalizeGitHubAppPrivateKey(value: string): string {
  const candidate = normalizePrivateKeyText(value);

  if (isPrivateKeyPem(candidate)) {
    return candidate;
  }

  try {
    const decoded = normalizePrivateKeyText(Buffer.from(value.trim(), "base64").toString("utf8"));

    if (isPrivateKeyPem(decoded)) {
      return decoded;
    }
  } catch {
    // Reported below with a stable message.
  }

  throw new Error("must be a PEM private key, escaped-newline PEM, or base64-encoded PEM");
}

function redactUrlPassword(value: string): string {
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

function readGitHubAppConfig(
  env: EnvironmentVariables,
  nodeEnv: RuntimeEnvironment,
  issues: ConfigValidationIssue[]
): GitHubAppConfig | null {
  const hasAnyGitHubValue = [
    env.GITHUB_APP_ID,
    env.GITHUB_APP_PRIVATE_KEY,
    env.GITHUB_WEBHOOK_SECRET,
    env.GITHUB_CLIENT_ID,
    env.GITHUB_CLIENT_SECRET
  ].some((value) => value?.trim());

  if (nodeEnv === "test" && !hasAnyGitHubValue) {
    return null;
  }

  const appId = readGitHubAppId(env, issues);
  const privateKey = readGitHubPrivateKey(env, issues);
  const webhookSecret = readRequired(env, "GITHUB_WEBHOOK_SECRET", issues);
  const clientId = readRequired(env, "GITHUB_CLIENT_ID", issues);
  const clientSecret = readRequired(env, "GITHUB_CLIENT_SECRET", issues);

  if (
    appId === null ||
    privateKey === null ||
    webhookSecret === null ||
    clientId === null ||
    clientSecret === null
  ) {
    return null;
  }

  return createGitHubAppConfig({
    appId,
    privateKey,
    webhookSecret,
    clientId,
    clientSecret
  });
}

function createGitHubAppConfig(values: Omit<GitHubAppConfig, "redacted" | "toJSON">): GitHubAppConfig {
  const redacted: RedactedGitHubAppConfig = {
    appId: "REDACTED",
    privateKey: "REDACTED",
    webhookSecret: "REDACTED",
    clientId: "REDACTED",
    clientSecret: "REDACTED"
  };
  const config = {} as GitHubAppConfig;

  Object.defineProperties(config, {
    appId: { value: values.appId, enumerable: false },
    privateKey: { value: values.privateKey, enumerable: false },
    webhookSecret: { value: values.webhookSecret, enumerable: false },
    clientId: { value: values.clientId, enumerable: false },
    clientSecret: { value: values.clientSecret, enumerable: false },
    redacted: { value: redacted, enumerable: true },
    toJSON: { value: () => redacted, enumerable: false }
  });

  return Object.freeze(config);
}

function readGitHubAppId(env: EnvironmentVariables, issues: ConfigValidationIssue[]): number | null {
  const value = readRequired(env, "GITHUB_APP_ID", issues);

  if (value === null) {
    return null;
  }

  const appId = Number(value);

  if (Number.isInteger(appId) && appId > 0) {
    return appId;
  }

  issues.push({
    variable: "GITHUB_APP_ID",
    message: "must be a positive integer"
  });
  return null;
}

function readGitHubPrivateKey(env: EnvironmentVariables, issues: ConfigValidationIssue[]): string | null {
  const value = readRequired(env, "GITHUB_APP_PRIVATE_KEY", issues);

  if (value === null) {
    return null;
  }

  try {
    return normalizeGitHubAppPrivateKey(value);
  } catch (error) {
    issues.push({
      variable: "GITHUB_APP_PRIVATE_KEY",
      message: error instanceof Error ? error.message : "is invalid"
    });
    return null;
  }
}

function readQueueConfig(env: EnvironmentVariables, issues: ConfigValidationIssue[]): QueueConfig | null {
  const redisUrl = readRequired(env, "REDIS_URL", issues);

  if (redisUrl === null || readRedisUrl(redisUrl, issues) === null) {
    return null;
  }

  return {
    redisUrl,
    redactedRedisUrl: redactRedisUrl(redisUrl)
  };
}

function readReviewConfig(env: EnvironmentVariables, issues: ConfigValidationIssue[]): ReviewConfig {
  return {
    dryRun: readOptionalBoolean(env, "DRY_RUN", true, issues),
    skipDraftPullRequests: readOptionalBoolean(env, "REVIEW_SKIP_DRAFT_PRS", true, issues),
    ciLogMaxBytes: readOptionalPositiveInteger(env, "REVIEW_CI_LOG_MAX_BYTES", DEFAULT_CI_LOG_MAX_BYTES, issues),
    artifactRetentionDays: readOptionalPositiveInteger(env, "ARTIFACT_RETENTION_DAYS", 30, issues),
    largePullRequest: {
      maxChangedFiles: readOptionalPositiveInteger(
        env,
        "REVIEW_LARGE_PR_MAX_CHANGED_FILES",
        DEFAULT_LARGE_PULL_REQUEST_THRESHOLDS.maxChangedFiles,
        issues
      ),
      maxDiffBytes: readOptionalPositiveInteger(
        env,
        "REVIEW_LARGE_PR_MAX_DIFF_BYTES",
        DEFAULT_LARGE_PULL_REQUEST_THRESHOLDS.maxDiffBytes,
        issues
      ),
      maxChangedLines: readOptionalPositiveInteger(
        env,
        "REVIEW_LARGE_PR_MAX_CHANGED_LINES",
        DEFAULT_LARGE_PULL_REQUEST_THRESHOLDS.maxChangedLines,
        issues
      ),
      maxEstimatedTokens: readOptionalPositiveInteger(
        env,
        "REVIEW_LARGE_PR_MAX_ESTIMATED_TOKENS",
        DEFAULT_LARGE_PULL_REQUEST_THRESHOLDS.maxEstimatedTokens,
        issues
      ),
      maxFilesAfterFiltering: readOptionalPositiveInteger(
        env,
        "REVIEW_LARGE_PR_MAX_FILTERED_FILES",
        DEFAULT_LARGE_PULL_REQUEST_THRESHOLDS.maxFilesAfterFiltering,
        issues
      ),
      maxSemgrepRuntimeMs: readOptionalPositiveInteger(
        env,
        "REVIEW_LARGE_PR_MAX_SEMGREP_RUNTIME_MS",
        DEFAULT_LARGE_PULL_REQUEST_THRESHOLDS.maxSemgrepRuntimeMs,
        issues
      ),
      summaryOnlyDiffBytes: readOptionalPositiveInteger(
        env,
        "REVIEW_SUMMARY_ONLY_DIFF_BYTES",
        DEFAULT_LARGE_PULL_REQUEST_THRESHOLDS.summaryOnlyDiffBytes,
        issues
      ),
      summaryOnlyChangedLines: readOptionalPositiveInteger(
        env,
        "REVIEW_SUMMARY_ONLY_CHANGED_LINES",
        DEFAULT_LARGE_PULL_REQUEST_THRESHOLDS.summaryOnlyChangedLines,
        issues
      ),
      summaryOnlyEstimatedTokens: readOptionalPositiveInteger(
        env,
        "REVIEW_SUMMARY_ONLY_ESTIMATED_TOKENS",
        DEFAULT_LARGE_PULL_REQUEST_THRESHOLDS.summaryOnlyEstimatedTokens,
        issues
      ),
      maxFullContextFiles: readOptionalPositiveInteger(
        env,
        "REVIEW_LARGE_PR_MAX_FULL_CONTEXT_FILES",
        DEFAULT_LARGE_PULL_REQUEST_THRESHOLDS.maxFullContextFiles,
        issues
      )
    }
  };
}

function readOptionalPositiveInteger(
  env: EnvironmentVariables,
  variable: string,
  fallback: number,
  issues: ConfigValidationIssue[]
): number {
  const rawValue = normalizeEnvironmentValue(env[variable]);

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  issues.push({
    variable,
    message: "must be a positive integer"
  });
  return fallback;
}

function readOptionalBoolean(
  env: EnvironmentVariables,
  variable: string,
  fallback: boolean,
  issues: ConfigValidationIssue[]
): boolean {
  const rawValue = normalizeEnvironmentValue(env[variable])?.toLowerCase();

  if (!rawValue) {
    return fallback;
  }

  const parsed = BOOLEAN_VALUES.get(rawValue);

  if (parsed === undefined) {
    issues.push({
      variable,
      message: "must be true, false, 1, or 0"
    });
    return fallback;
  }

  return parsed;
}

function readRequired(env: EnvironmentVariables, variable: string, issues: ConfigValidationIssue[]): string | null {
  const value = normalizeEnvironmentValue(env[variable]);

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
  const value = normalizeEnvironmentValue(env[variable]);
  return value ? value : null;
}

function normalizeEnvironmentValue(value: string | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
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

function readRedisUrl(value: string, issues: ConfigValidationIssue[]): URL | null {
  try {
    const url = new URL(value);

    if ((url.protocol === "redis:" || url.protocol === "rediss:") && url.hostname) {
      return url;
    }
  } catch {
    // Reported below with a stable message.
  }

  issues.push({
    variable: "REDIS_URL",
    message: "must be a Redis connection string"
  });
  return null;
}

function readDatabaseSsl(
  env: EnvironmentVariables,
  nodeEnv: RuntimeEnvironment,
  issues: ConfigValidationIssue[]
): boolean | null {
  const rawValue = normalizeEnvironmentValue(env.DATABASE_SSL)?.toLowerCase();

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
  const normalized = normalizeEnvironmentValue(value);

  if (!normalized) {
    return fallback;
  }

  const port = Number(normalized);

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
    normalizeEnvironmentValue(value)
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

function normalizePrivateKeyText(value: string): string {
  return value.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\\n/g, "\n");
}

function isPrivateKeyPem(value: string): boolean {
  return /^-----BEGIN (?:RSA )?PRIVATE KEY-----\n[\s\S]+\n-----END (?:RSA )?PRIVATE KEY-----$/.test(value);
}
