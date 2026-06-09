import { getRuntimeEnvDiagnostics } from "../src/config/runtime-env-diagnostics";

describe("runtime environment diagnostics", () => {
  it("describes missing, unresolved, and malformed deployment values without exposing secrets", () => {
    const diagnostics = getRuntimeEnvDiagnostics({
      DATABASE_URL: "${DATABASE_URL}",
      GITHUB_APP_ID: "not-a-number",
      GITHUB_APP_PRIVATE_KEY: "not-a-private-key",
      GITHUB_WEBHOOK_SECRET: "super-secret",
      GITHUB_CLIENT_ID: "",
      GITHUB_CLIENT_SECRET: undefined,
      INSFORGE_BASE_URL: "https://h35yzuga.eu-central.insforge.app",
      INSFORGE_SERVICE_KEY: "insforge-service-secret",
      REDIS_URL: "\"redis://redis:6379\""
    });

    expect(diagnostics).toContainEqual({
      variable: "DATABASE_URL",
      state: "unresolved-placeholder",
      hint: "Compose interpolation did not resolve this value"
    });
    expect(diagnostics).toContainEqual({
      variable: "GITHUB_APP_ID",
      state: "present",
      hint: "not a positive integer"
    });
    expect(diagnostics).toContainEqual({
      variable: "GITHUB_APP_PRIVATE_KEY",
      state: "present",
      hint: "not PEM-like or base64-like"
    });
    expect(diagnostics).toContainEqual({
      variable: "GITHUB_CLIENT_ID",
      state: "empty"
    });
    expect(diagnostics).toContainEqual({
      variable: "GITHUB_CLIENT_SECRET",
      state: "missing"
    });
    expect(diagnostics).toContainEqual({
      variable: "INSFORGE_BASE_URL",
      state: "present"
    });
    expect(diagnostics).toContainEqual({
      variable: "INSFORGE_SERVICE_KEY",
      state: "present"
    });
    expect(diagnostics).toContainEqual({
      variable: "REDIS_URL",
      state: "quoted",
      hint: "redis"
    });
    expect(JSON.stringify(diagnostics)).not.toContain("super-secret");
    expect(JSON.stringify(diagnostics)).not.toContain("insforge-service-secret");
  });
});
