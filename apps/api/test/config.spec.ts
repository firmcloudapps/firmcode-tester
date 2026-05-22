import { ConfigValidationError, createApiRuntimeConfig, normalizeGitHubAppPrivateKey } from "@firmcode/shared";
import { runDatabaseConnectionSmokeCheck } from "../src/infrastructure/database/database-smoke";

const RAW_PRIVATE_KEY = [
  "-----BEGIN RSA PRIVATE KEY-----",
  "MIIBOgIBAAJBANotARealKeyButValidPemShapeForConfigTests",
  "-----END RSA PRIVATE KEY-----"
].join("\n");

const VALID_ENV = {
  NODE_ENV: "development",
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
    expect(config.github?.appId).toBe(12345);
    expect(config.github?.privateKey).toBe(RAW_PRIVATE_KEY);
    expect(config.port).toBe(3001);
  });

  it("fails fast when Clerk, database, or GitHub variables are missing", () => {
    expect(() => createApiRuntimeConfig({ NODE_ENV: "development" })).toThrow(ConfigValidationError);
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
        DATABASE_SSL: "false"
      })
    ).toThrow(/DATABASE_SSL must be true/);
  });

  it("rejects an invalid API port", () => {
    expect(() =>
      createApiRuntimeConfig({
        ...VALID_ENV,
        PORT: "99999"
      })
    ).toThrow(/PORT must be an integer/);
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
