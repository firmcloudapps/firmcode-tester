import { createWebClerkConfig, type ClerkWebConfig, type EnvironmentVariables } from "@firmcode/shared";

export function loadWebClerkConfig(env: EnvironmentVariables = process.env): ClerkWebConfig {
  return createWebClerkConfig(env);
}
