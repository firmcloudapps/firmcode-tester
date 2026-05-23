import { initialReviewSchemaMigration } from "./migrations/001_initial_review_schema";
import { dryRunPublishedCommentsMigration } from "./migrations/002_dry_run_published_comments";
import { dashboardAuthRetryStateMigration } from "./migrations/003_dashboard_auth_retry_state";
import { repositoryReviewConfigurationMigration } from "./migrations/004_repository_review_configuration";

export interface DatabaseQueryResult<Row = unknown> {
  readonly rows: Row[];
}

export interface DatabaseExecutor {
  query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<DatabaseQueryResult<Row>>;
}

export interface DatabaseMigration {
  readonly id: string;
  readonly name: string;
  readonly sql: string;
}

export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
  initialReviewSchemaMigration,
  dryRunPublishedCommentsMigration,
  dashboardAuthRetryStateMigration,
  repositoryReviewConfigurationMigration
];

interface AppliedMigrationRow {
  readonly id: string;
}

export async function runDatabaseMigrations(
  database: DatabaseExecutor,
  migrations: readonly DatabaseMigration[] = DATABASE_MIGRATIONS
): Promise<string[]> {
  await database.query(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
`);

  const appliedResult = await database.query<AppliedMigrationRow>("SELECT id FROM schema_migrations");
  const appliedMigrationIds = new Set(appliedResult.rows.map((row) => row.id));
  const newlyAppliedMigrationIds: string[] = [];

  for (const migration of migrations) {
    if (appliedMigrationIds.has(migration.id)) {
      continue;
    }

    await database.query("BEGIN");

    try {
      await database.query(migration.sql);
      await database.query("INSERT INTO schema_migrations (id, name) VALUES ($1, $2)", [
        migration.id,
        migration.name
      ]);
      await database.query("COMMIT");
      newlyAppliedMigrationIds.push(migration.id);
    } catch (error) {
      await database.query("ROLLBACK");
      throw error;
    }
  }

  return newlyAppliedMigrationIds;
}
