import { ConfigValidationError, createApiRuntimeConfig } from "@firmcode/shared";
import { runDatabaseConnectionSmokeCheck } from "../src/infrastructure/database/database-smoke";

const VALID_ENV = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://firmcode:secret@localhost:5432/firmcode",
  DATABASE_SSL: "false",
  CLERK_SECRET_KEY: "sk_test_example"
};

describe("API runtime config", () => {
  it("validates required Clerk and database variables", () => {
    const config = createApiRuntimeConfig(VALID_ENV);

    expect(config.database.url).toBe(VALID_ENV.DATABASE_URL);
    expect(config.database.ssl).toBe(false);
    expect(config.clerk.secretKey).toBe("sk_test_example");
    expect(config.port).toBe(3001);
  });

  it("fails fast when Clerk or database variables are missing", () => {
    expect(() => createApiRuntimeConfig({ NODE_ENV: "development" })).toThrow(ConfigValidationError);
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
