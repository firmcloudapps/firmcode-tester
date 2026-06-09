import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import { PostgresGitHubDashboardStore } from "../src/modules/github/github.store";
import { PostgresRepositoriesStore } from "../src/modules/repositories/repositories.store";
import { resolveRepositoryAccessScope } from "../src/modules/auth/repository-access-scope";

interface PgPoolLike {
  query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
}

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

describe("repository access scope", () => {
  let pool: PgPoolLike;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
  });

  afterEach(async () => {
    await pool.end();
  });

  it("admins do not read customer repository code by default", async () => {
    await seedWorkspaceWithRepositories(pool, {
      workspaceId: WORKSPACE_ID,
      repoIds: [REPOSITORY_A_ID, REPOSITORY_B_ID],
      memberships: [{ userId: "admin-1", role: "admin" }]
    });

    const store = new PostgresRepositoriesStore(pool);
    const adminScope = resolveRepositoryAccessScope({ role: "admin", userId: "admin-1" });
    const result = await store.listRepositories({ workspaceId: WORKSPACE_ID, accessScope: adminScope });

    expect(result.repositories).toHaveLength(0);
  });

  it("developers only see repositories they were backfilled to access", async () => {
    await seedWorkspaceWithRepositories(pool, {
      workspaceId: WORKSPACE_ID,
      repoIds: [REPOSITORY_A_ID, REPOSITORY_B_ID],
      memberships: [
        { userId: "dev-1", role: "developer" },
        { userId: "admin-1", role: "admin" }
      ]
    });
    // Dev gets access only to repo-a
    await pool.query(
      `INSERT INTO repository_access (repository_id, user_id, granted_by_user_id)
       VALUES ($1, 'dev-1', 'admin-1')`,
      [REPOSITORY_A_ID]
    );

    const store = new PostgresRepositoriesStore(pool);
    const devScope = resolveRepositoryAccessScope({ role: "developer", userId: "dev-1" });
    const result = await store.listRepositories({ workspaceId: WORKSPACE_ID, accessScope: devScope });

    expect(result.repositories).toHaveLength(1);
    expect(result.repositories[0].id).toBe(REPOSITORY_A_ID);
  });

  it("developer detail returns null for a repository they cannot access", async () => {
    await seedWorkspaceWithRepositories(pool, {
      workspaceId: WORKSPACE_ID,
      repoIds: [REPOSITORY_A_ID, REPOSITORY_B_ID],
      memberships: [{ userId: "dev-1", role: "developer" }]
    });

    const store = new PostgresRepositoriesStore(pool);
    const devScope = resolveRepositoryAccessScope({ role: "developer", userId: "dev-1" });
    const detail = await store.getRepositoryDetail({
      repositoryId: REPOSITORY_A_ID,
      workspaceId: WORKSPACE_ID,
      accessScope: devScope,
      permissions: { canManageConfiguration: false, canRetryReviewRuns: false, canAccessRawArtifacts: false, canTriggerCodebaseScans: false, canManageCodebaseScans: false }
    });

    expect(detail).toBeNull();
  });

  it("auto-grant on upsert gives access to the connecting user", async () => {
    await seedWorkspaceWithRepositories(pool, {
      workspaceId: WORKSPACE_ID,
      repoIds: [],
      memberships: [
        { userId: "dev-1", role: "developer" }
      ]
    });

    const githubStore = new PostgresGitHubDashboardStore(pool, () => REPOSITORY_NEW_ID);
    await githubStore.upsertInstallationRepository({
      installationUuid: INSTALLATION_ID,
      grantAccessToUserId: "dev-1",
      repository: {
        githubRepositoryId: 999,
        owner: "openclaw",
        name: "newrepo",
        fullName: "openclaw/newrepo",
        private: false,
        defaultBranch: "main"
      }
    });

    const store = new PostgresRepositoriesStore(pool);
    const devScope = resolveRepositoryAccessScope({ role: "developer", userId: "dev-1" });
    const result = await store.listRepositories({ workspaceId: WORKSPACE_ID, accessScope: devScope });

    expect(result.repositories).toHaveLength(1);
    expect(result.repositories[0].id).toBe(REPOSITORY_NEW_ID);
  });
});

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000101";
const INSTALLATION_ID = "00000000-0000-4000-8000-000000000301";
const REPOSITORY_A_ID = "00000000-0000-4000-8000-000000000201";
const REPOSITORY_B_ID = "00000000-0000-4000-8000-000000000202";
const REPOSITORY_NEW_ID = "00000000-0000-4000-8000-000000000203";

async function seedWorkspaceWithRepositories(
  pool: PgPoolLike,
  input: {
    workspaceId: string;
    repoIds: readonly string[];
    memberships: readonly { userId: string; role: string }[];
  }
): Promise<void> {
  await pool.query(
    `INSERT INTO workspaces (id, name) VALUES ($1, 'Test Workspace')`,
    [input.workspaceId]
  );

  await pool.query(
    `INSERT INTO github_installations (id, installation_id, permissions_json)
     VALUES ($1, $2, '{}')`,
    [INSTALLATION_ID, 1]
  );
  await pool.query(
    `UPDATE github_installations SET workspace_id = $1 WHERE id = $2`,
    [input.workspaceId, INSTALLATION_ID]
  );

  for (const [index, repoId] of input.repoIds.entries()) {
    await pool.query(
      `INSERT INTO repositories (
        id, installation_id, github_repository_id,
        owner, name, full_name, private, default_branch, enabled
      ) VALUES ($1, $2, $3, 'openclaw', 'repo', $4, false, 'main', true)`,
      [repoId, INSTALLATION_ID, 100 + index, `openclaw/repo-${index}`]
    );
  }

  for (const membership of input.memberships) {
    await pool.query(
      `INSERT INTO user_profiles (id, identity_provider, provider_user_id)
       VALUES ($1, 'insforge', $1)
       ON CONFLICT (id) DO NOTHING`,
      [membership.userId]
    );
    await pool.query(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role, active)
       VALUES ($1, $2, $3, true)`,
      [input.workspaceId, membership.userId, membership.role]
    );
  }
}
