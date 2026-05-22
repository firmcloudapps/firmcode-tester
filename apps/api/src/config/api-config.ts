import { createApiRuntimeConfig, type ApiRuntimeConfig, type EnvironmentVariables } from "@firmcode/shared";

export function loadApiConfig(env: EnvironmentVariables = process.env): ApiRuntimeConfig {
  return createApiRuntimeConfig(env);
}
