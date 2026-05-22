import { Pool } from "pg";
import { runDatabaseMigrations } from "./migrations";

function readDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const databaseUrl = env.DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    throw new Error("DATABASE_URL is required to run database migrations");
  }

  return databaseUrl;
}

function readDatabaseSsl(env: NodeJS.ProcessEnv): boolean {
  const value = env.DATABASE_SSL;

  if (value === undefined) {
    return true;
  }

  return value.toLowerCase() !== "false";
}

export async function runDatabaseMigrationsFromEnvironment(env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const pool = new Pool({
    connectionString: readDatabaseUrl(env),
    ssl: readDatabaseSsl(env) ? { rejectUnauthorized: false } : false
  });

  try {
    return await runDatabaseMigrations(pool);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runDatabaseMigrationsFromEnvironment()
    .then((appliedMigrationIds) => {
      const migrationList = appliedMigrationIds.length > 0 ? appliedMigrationIds.join(", ") : "none";
      console.log(`Database migrations applied: ${migrationList}`);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "unknown migration error";
      console.error(`Database migration failed: ${message}`);
      process.exitCode = 1;
    });
}
