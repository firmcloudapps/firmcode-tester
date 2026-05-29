import { ConfigValidationError, createApiRuntimeConfig, normalizeGitHubAppPrivateKey } from "@firmcode/shared";
import { runDatabaseConnectionSmokeCheck } from "../src/infrastructure/database/database-smoke";

const RAW_PRIVATE_KEY = [
  "-----BEGIN RSA PRIVATE KEY-----",
  "MIIBOgIBAAJBANotARealKeyButValidPemShapeForConfigTests",
  "-----END RSA PRIVATE KEY-----"
].join("\n");

const VALID_ENV = {
  NODE_ENV: "development",
  APP_URL: "https://firmcode.firmoncloud.com",
  API_URL: "https://firmcodeapi.firmoncloud.com",
  DATABASE_URL: "postgresql://firmcode:secret@localhost:5432/firmcode",
  DATABASE_SSL: "false",
  REDIS_URL: "redis://:secret@localhost:6379",
  CLERK_SECRET_KEY: "sk_test_example",
  GITHUB_APP_ID: "12345",
  GITHUB_APP_PRIVATE_KEY: RAW_PRIVATE_KEY,
  GITHUB_WEBHOOK_SECRET: "github_webhook_secret",
  GITHUB_CLIENT_ID: "github_client_id",
  GITHUB_CLIENT_SECRET: "github_client_secret"
};

describe("API runtime config", () => {
  it("validates required Clerk and database variables", () => {
    const config = createApiRuntimeConfig(VALID_ENV);

    expect(config.database.url).toBe(VALID_ENV.DATABASE_URL);
    expect(config.database.ssl).toBe(false);
    expect(config.queue.redactedRedisUrl).toBe("redis://:REDACTED@localhost:6379");
    expect(config.clerk.secretKey).toBe("sk_test_example");
    expect(config.clerk.jwtAudience).toBeNull();
    expect(config.clerk.defaultOrganization).toEqual({
      id: "org_3EGsxXDTl8pWEfV6da6oENrYhRr",
      name: "Firmcode AI",
      role: "org:developer"
    });
    expect(config.publicAppUrl).toBe("https://firmcode.firmoncloud.com");
    expect(config.publicApiUrl).toBe("https://firmcodeapi.firmoncloud.com");
    expect(config.github?.appId).toBe(12345);
    expect(config.github?.privateKey).toBe(RAW_PRIVATE_KEY);
    expect(config.port).toBe(3001);
    expect(config.review.dryRun).toBe(true);
    expect(config.review.ciLogMaxBytes).toBe(20_000);
    expect(config.review.largePullRequest.maxChangedFiles).toBe(100);
    expect(config.codebaseScan.defaultCadenceHours).toBe(24);
  });

  it("loads the configured Clerk JWT audience", () => {
    const config = createApiRuntimeConfig({
      ...VALID_ENV,
      CLERK_JWT_AUDIENCE: "firmcode-api"
    });

    expect(config.clerk.secretKey).toBe("sk_test_example");
    expect(config.clerk.jwtAudience).toBe("firmcode-api");
  });

  it("loads the default Clerk organization used for signup membership", () => {
    const config = createApiRuntimeConfig({
      ...VALID_ENV,
      FIRMCODE_DEFAULT_CLERK_ORGANIZATION_ID: "org_3EGsxXDTl8pWEfV6da6oENrYhRr",
      FIRMCODE_DEFAULT_CLERK_ORGANIZATION_NAME: "Firmcode AI",
      FIRMCODE_DEFAULT_CLERK_ORGANIZATION_ROLE: "org:developer"
    });

    expect(config.clerk.defaultOrganization).toEqual({
      id: "org_3EGsxXDTl8pWEfV6da6oENrYhRr",
      name: "Firmcode AI",
      role: "org:developer"
    });
  });

  it("accepts values copied with surrounding quotes from deployment UIs", () => {
    const config = createApiRuntimeConfig({
      ...VALID_ENV,
      DATABASE_URL: `"${VALID_ENV.DATABASE_URL}"`,
      REDIS_URL: `"${VALID_ENV.REDIS_URL}"`,
      CLERK_SECRET_KEY: `"${VALID_ENV.CLERK_SECRET_KEY}"`,
      GITHUB_APP_ID: `"${VALID_ENV.GITHUB_APP_ID}"`,
      GITHUB_APP_PRIVATE_KEY: `"${RAW_PRIVATE_KEY.replace(/\n/g, "\\n")}"`,
      GITHUB_WEBHOOK_SECRET: `"${VALID_ENV.GITHUB_WEBHOOK_SECRET}"`,
      GITHUB_CLIENT_ID: `"${VALID_ENV.GITHUB_CLIENT_ID}"`,
      GITHUB_CLIENT_SECRET: `"${VALID_ENV.GITHUB_CLIENT_SECRET}"`
    });

    expect(config.database.url).toBe(VALID_ENV.DATABASE_URL);
    expect(config.github?.appId).toBe(12345);
    expect(config.github?.privateKey).toBe(RAW_PRIVATE_KEY);
  });

  it("fails fast when Clerk, database, or GitHub variables are missing", () => {
    expect(() => createApiRuntimeConfig({ NODE_ENV: "development" })).toThrow(ConfigValidationError);
  });

  it("requires a Clerk secret key", () => {
    const { CLERK_SECRET_KEY: _missingSecret, ...env } = VALID_ENV;

    expect(() => createApiRuntimeConfig(env)).toThrow(/CLERK_SECRET_KEY is required/);
  });

  it("allows GitHub App config to be omitted in test environments", () => {
    const config = createApiRuntimeConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://firmcode:secret@localhost:5432/firmcode",
      DATABASE_SSL: "false",
      REDIS_URL: "redis://localhost:6379",
      CLERK_SECRET_KEY: "sk_test_example"
    });

    expect(config.github).toBeNull();
  });

  it("requires GitHub App config in non-test environments", () => {
    const { GITHUB_WEBHOOK_SECRET: _missingWebhookSecret, ...env } = VALID_ENV;

    expect(() => createApiRuntimeConfig(env)).toThrow(/GITHUB_WEBHOOK_SECRET is required/);
  });

  it("redacts GitHub App config during JSON serialization", () => {
    const config = createApiRuntimeConfig(VALID_ENV);
    const serialized = JSON.stringify(config);

    expect(serialized).toContain("\"github\"");
    expect(serialized).toContain("\"privateKey\":\"REDACTED\"");
    expect(serialized).not.toContain(RAW_PRIVATE_KEY);
    expect(serialized).not.toContain(VALID_ENV.GITHUB_WEBHOOK_SECRET);
    expect(serialized).not.toContain(VALID_ENV.GITHUB_CLIENT_SECRET);
  });

  it("requires NeonDB SSL in production", () => {
    expect(() =>
      createApiRuntimeConfig({
        ...VALID_ENV,
        NODE_ENV: "production",
        CLERK_JWT_AUDIENCE: "firmcode-api",
        DATABASE_SSL: "false"
      })
    ).toThrow(/DATABASE_SSL must be true/);
  });

  it("requires a Clerk JWT audience in production", () => {
    expect(() =>
      createApiRuntimeConfig({
        ...VALID_ENV,
        NODE_ENV: "production",
        DATABASE_SSL: "true"
      })
    ).toThrow(/CLERK_JWT_AUDIENCE is required/);
  });

  it("rejects an invalid API port", () => {
    expect(() =>
      createApiRuntimeConfig({
        ...VALID_ENV,
        PORT: "99999"
      })
    ).toThrow(/PORT must be an integer/);
  });

  it("loads configurable large-PR thresholds", () => {
    const config = createApiRuntimeConfig({
      ...VALID_ENV,
      REVIEW_LARGE_PR_MAX_CHANGED_FILES: "25",
      REVIEW_LARGE_PR_MAX_DIFF_BYTES: "90000",
      REVIEW_LARGE_PR_MAX_CHANGED_LINES: "1200",
      REVIEW_LARGE_PR_MAX_ESTIMATED_TOKENS: "8000",
      REVIEW_LARGE_PR_MAX_FILTERED_FILES: "20",
      REVIEW_LARGE_PR_MAX_SEMGREP_RUNTIME_MS: "15000",
      REVIEW_SUMMARY_ONLY_DIFF_BYTES: "200000",
      REVIEW_SUMMARY_ONLY_CHANGED_LINES: "4000",
      REVIEW_SUMMARY_ONLY_ESTIMATED_TOKENS: "25000",
      REVIEW_LARGE_PR_MAX_FULL_CONTEXT_FILES: "12",
      REVIEW_CI_LOG_MAX_BYTES: "12000"
    });

    expect(config.review.ciLogMaxBytes).toBe(12000);
    expect(config.review.largePullRequest).toEqual({
      maxChangedFiles: 25,
      maxDiffBytes: 90000,
      maxChangedLines: 1200,
      maxEstimatedTokens: 8000,
      maxFilesAfterFiltering: 20,
      maxSemgrepRuntimeMs: 15000,
      summaryOnlyDiffBytes: 200000,
      summaryOnlyChangedLines: 4000,
      summaryOnlyEstimatedTokens: 25000,
      maxFullContextFiles: 12
    });
  });

  it("allows GitHub publishing to be enabled explicitly", () => {
    const config = createApiRuntimeConfig({
      ...VALID_ENV,
      DRY_RUN: "false"
    });

    expect(config.review.dryRun).toBe(false);
  });

  it("rejects invalid large-PR threshold values", () => {
    expect(() =>
      createApiRuntimeConfig({
        ...VALID_ENV,
        REVIEW_LARGE_PR_MAX_CHANGED_FILES: "0"
      })
    ).toThrow(/REVIEW_LARGE_PR_MAX_CHANGED_FILES must be a positive integer/);
  });

  it("rejects invalid CI log truncation limits", () => {
    expect(() =>
      createApiRuntimeConfig({
        ...VALID_ENV,
        REVIEW_CI_LOG_MAX_BYTES: "0"
      })
    ).toThrow(/REVIEW_CI_LOG_MAX_BYTES must be a positive integer/);
  });

  it("loads configurable codebase scan cadence", () => {
    const config = createApiRuntimeConfig({
      ...VALID_ENV,
      CODEBASE_SCAN_DEFAULT_CADENCE_HOURS: "12"
    });

    expect(config.codebaseScan.defaultCadenceHours).toBe(12);
  });

  it("rejects invalid codebase scan cadence values", () => {
    expect(() =>
      createApiRuntimeConfig({
        ...VALID_ENV,
        CODEBASE_SCAN_DEFAULT_CADENCE_HOURS: "0"
      })
    ).toThrow(/CODEBASE_SCAN_DEFAULT_CADENCE_HOURS must be a positive integer/);
  });
});

describe("GitHub App private key normalization", () => {
  it("keeps raw PEM private keys", () => {
    expect(normalizeGitHubAppPrivateKey(RAW_PRIVATE_KEY)).toBe(RAW_PRIVATE_KEY);
  });

  it("supports escaped-newline PEM private keys", () => {
    expect(normalizeGitHubAppPrivateKey(RAW_PRIVATE_KEY.replace(/\n/g, "\\n"))).toBe(RAW_PRIVATE_KEY);
  });

  it("supports base64-encoded PEM private keys", () => {
    expect(normalizeGitHubAppPrivateKey(Buffer.from(RAW_PRIVATE_KEY, "utf8").toString("base64"))).toBe(
      RAW_PRIVATE_KEY
    );
  });

  it("rejects invalid private key formats", () => {
    expect(() => normalizeGitHubAppPrivateKey("not a private key")).toThrow(/PEM private key/);
  });
});

describe("database connection smoke check", () => {
  it("accepts a PostgreSQL-compatible connection string", () => {
    const smokeCheck = runDatabaseConnectionSmokeCheck({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://firmcode:secret@ep-example.us-east-2.aws.neon.tech/firmcode?sslmode=require",
      DATABASE_SSL: "true"
    });

    expect(smokeCheck).toEqual({
      host: "ep-example.us-east-2.aws.neon.tech",
      database: "firmcode",
      protocol: "postgres",
      ssl: true,
      redactedUrl: "postgres://firmcode:REDACTED@ep-example.us-east-2.aws.neon.tech/firmcode?sslmode=require"
    });
  });

  it("rejects non-PostgreSQL connection strings", () => {
    expect(() =>
      runDatabaseConnectionSmokeCheck({
        NODE_ENV: "development",
        DATABASE_URL: "mysql://firmcode:secret@localhost:3306/firmcode",
        DATABASE_SSL: "false"
      })
    ).toThrow(/PostgreSQL connection string/);
  });
});

describe("queue config", () => {
  it("rejects non-Redis connection strings", () => {
    expect(() =>
      createApiRuntimeConfig({
        ...VALID_ENV,
        REDIS_URL: "http://localhost:6379"
      })
    ).toThrow(/Redis connection string/);
  });
});
