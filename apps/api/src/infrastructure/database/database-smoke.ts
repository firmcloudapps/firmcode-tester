import {
  createDatabaseConnectionSmokeCheck,
  type DatabaseConnectionSmokeCheck,
  type EnvironmentVariables
} from "@firmcode/shared";

export function runDatabaseConnectionSmokeCheck(
  env: EnvironmentVariables = process.env
): DatabaseConnectionSmokeCheck {
  return createDatabaseConnectionSmokeCheck(env);
}
