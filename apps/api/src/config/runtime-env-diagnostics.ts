import type { EnvironmentVariables } from "@firmcode/shared";

type RuntimeEnvState = "missing" | "empty" | "unresolved-placeholder" | "quoted" | "present";

interface RuntimeEnvDiagnostic {
  readonly variable: string;
  readonly state: RuntimeEnvState;
  readonly hint?: string;
}

const DIAGNOSTIC_VARIABLES = [
  "DATABASE_URL",
  "GITHUB_APP_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_WEBHOOK_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "CLERK_SECRET_KEY",
  "REDIS_URL"
] as const;

export function getRuntimeEnvDiagnostics(env: EnvironmentVariables): RuntimeEnvDiagnostic[] {
  return DIAGNOSTIC_VARIABLES.map((variable) => describeRuntimeEnvValue(variable, env[variable]));
}

export function logRuntimeEnvDiagnostics(env: EnvironmentVariables = process.env): void {
  const diagnostics = getRuntimeEnvDiagnostics(env);
  console.error("[runtime-config] Safe environment diagnostics:");

  for (const diagnostic of diagnostics) {
    const hint = diagnostic.hint ? ` (${diagnostic.hint})` : "";
    console.error(`[runtime-config] ${diagnostic.variable}: ${diagnostic.state}${hint}`);
  }
}

function describeRuntimeEnvValue(variable: string, value: string | undefined): RuntimeEnvDiagnostic {
  if (value === undefined) {
    return { variable, state: "missing" };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { variable, state: "empty" };
  }

  if (/^\$\{[A-Z0-9_]+\}$/.test(trimmed)) {
    return { variable, state: "unresolved-placeholder", hint: "Compose interpolation did not resolve this value" };
  }

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return {
      variable,
      state: "quoted",
      hint: describeValueShape(variable, trimmed.slice(1, -1).trim())
    };
  }

  return { variable, state: "present", hint: describeValueShape(variable, trimmed) };
}

function describeValueShape(variable: string, value: string): string | undefined {
  switch (variable) {
    case "DATABASE_URL":
      return describeDatabaseUrl(value);
    case "GITHUB_APP_ID":
      return Number.isInteger(Number(value)) && Number(value) > 0 ? "positive integer" : "not a positive integer";
    case "GITHUB_APP_PRIVATE_KEY":
      return describePrivateKey(value);
    case "REDIS_URL":
      return describeRedisUrl(value);
    default:
      return undefined;
  }
}

function describeDatabaseUrl(value: string): string {
  try {
    const url = new URL(value);
    const protocol = url.protocol.replace(/:$/, "") || "unknown";
    const database = url.pathname.length > 1 ? "has database name" : "missing database name";
    return `${protocol}, ${database}`;
  } catch {
    return "not a URL";
  }
}

function describeRedisUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol.replace(/:$/, "") || "unknown";
  } catch {
    return "not a URL";
  }
}

function describePrivateKey(value: string): string {
  if (value.includes("-----BEGIN") && value.includes("\\n")) {
    return "escaped-newline PEM-like";
  }

  if (value.includes("-----BEGIN") && value.includes("\n")) {
    return "multiline PEM-like";
  }

  if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 80) {
    return "base64-like";
  }

  return "not PEM-like or base64-like";
}
