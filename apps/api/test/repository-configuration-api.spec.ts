import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import { RepositoriesController } from "../src/modules/repositories/repositories.controller";
import { RepositoryConfigurationService } from "../src/modules/repositories/repository-configuration.service";
import { PostgresRepositoriesStore } from "../src/modules/repositories/repositories.store";
import { PostgresDashboardAuthStore } from "../src/modules/review-runs/dashboard-auth.store";

interface PgPoolLike {
  query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
}

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000101";
const OTHER_WORKSPACE_ID = "00000000-0000-4000-8000-000000000102";
const REPOSITORY_ID = "00000000-0000-4000-8000-000000000201";
const OTHER_REPOSITORY_ID = "00000000-0000-4000-8000-000000000202";
const OWNER_USER_ID = "user_owner";
const ADMIN_USER_ID = "user_admin";
const DEVELOPER_USER_ID = "user_developer";
const VIEWER_USER_ID = "user_viewer";

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

describe("repository automation configuration dashboard API", () => {
  let pool: PgPoolLike;
  let controller: RepositoriesController;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    await seedRepositoryConfigurationData(pool);

    const repositoriesStore = new PostgresRepositoriesStore(pool);
    controller = new RepositoriesController(
      repositoriesStore,
      new RepositoryConfigurationService(repositoriesStore, new PostgresDashboardAuthStore(pool))
    );
  });

  afterEach(async () => {
    await pool.end();
  });

  it("fetches the typed repository configuration for an owner", async () => {
    const configuration = await controller.getRepositoryConfiguration(REPOSITORY_ID, WORKSPACE_ID, OWNER_USER_ID);

    expect(configuration).toMatchObject({
      repositoryId: REPOSITORY_ID,
      automationEnabled: true,
      draftPullRequestReviewsEnabled: false,
      maxInlineComments: 10,
      severityThreshold: "medium",
      semgrepEnabled: true,
      treeSitterEnabled: true,
      ciExplanationEnabled: true,
      infrastructureReviewEnabled: true,
      dryRunEnabled: true,
      updatedByClerkUserId: null
    });
    expect(configuration.createdAt).toEqual(expect.any(String));
    expect(configuration.updatedAt).toEqual(expect.any(String));
  });

  it("allows owners and admins to disable and enable repository automation", async () => {
    const disabled = await controller.updateRepositoryConfiguration(
      REPOSITORY_ID,
      { automationEnabled: false },
      WORKSPACE_ID,
      OWNER_USER_ID
    );
    const enabled = await controller.updateRepositoryConfiguration(
      REPOSITORY_ID,
      { automationEnabled: true },
      WORKSPACE_ID,
      ADMIN_USER_ID
    );
    const repositoryRows = await pool.query<{ enabled: boolean }>("SELECT enabled FROM repositories WHERE id = $1", [
      REPOSITORY_ID
    ]);

    expect(disabled).toMatchObject({
      automationEnabled: false,
      updatedByClerkUserId: OWNER_USER_ID
    });
    expect(enabled).toMatchObject({
      automationEnabled: true,
      updatedByClerkUserId: ADMIN_USER_ID
    });
    expect(repositoryRows.rows).toEqual([{ enabled: true }]);
  });

  it("persists partial configuration changes and preserves existing review policy fields", async () => {
    await controller.updateRepositoryConfiguration(
      REPOSITORY_ID,
      {
        maxInlineComments: 5,
        severityThreshold: "high",
        semgrepEnabled: false,
        dryRunEnabled: false
      },
      WORKSPACE_ID,
      OWNER_USER_ID
    );
    await controller.updateRepositoryConfiguration(REPOSITORY_ID, { automationEnabled: false }, WORKSPACE_ID, OWNER_USER_ID);

    const freshStore = new PostgresRepositoriesStore(pool);
    const persisted = await freshStore.getRepositoryConfiguration({
      repositoryId: REPOSITORY_ID,
      workspaceId: WORKSPACE_ID
    });

    expect(persisted).toMatchObject({
      automationEnabled: false,
      maxInlineComments: 5,
      severityThreshold: "high",
      semgrepEnabled: false,
      dryRunEnabled: false,
      updatedByClerkUserId: OWNER_USER_ID
    });
  });

  it("rejects unknown fields, invalid field types, and invalid numeric bounds", async () => {
    await expect(
      controller.updateRepositoryConfiguration(REPOSITORY_ID, { enabled: false }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRepositoryConfiguration(REPOSITORY_ID, { automationEnabled: "false" }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRepositoryConfiguration(REPOSITORY_ID, { maxInlineComments: -1 }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRepositoryConfiguration(REPOSITORY_ID, { maxInlineComments: 51 }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRepositoryConfiguration(REPOSITORY_ID, { severityThreshold: "urgent" }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
  });

  it("enforces owner/admin repository configuration capabilities", async () => {
    await expect(controller.getRepositoryConfiguration(REPOSITORY_ID, WORKSPACE_ID, undefined)).rejects.toThrow(
      UnauthorizedException
    );
    await expect(
      controller.updateRepositoryConfiguration(REPOSITORY_ID, { automationEnabled: false }, WORKSPACE_ID, DEVELOPER_USER_ID)
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.updateRepositoryConfiguration(REPOSITORY_ID, { automationEnabled: false }, WORKSPACE_ID, VIEWER_USER_ID)
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.updateRepositoryConfiguration(OTHER_REPOSITORY_ID, { automationEnabled: false }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(NotFoundException);
    await expect(
      controller.updateRepositoryConfiguration(REPOSITORY_ID, { automationEnabled: false }, OTHER_WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(NotFoundException);
  });
});

async function seedRepositoryConfigurationData(pool: PgPoolLike): Promise<void> {
  await pool.query(
    `
INSERT INTO workspaces (id, clerk_org_id, name) VALUES
('${WORKSPACE_ID}', 'org_firmcode', 'Firmcode'),
('${OTHER_WORKSPACE_ID}', 'org_other', 'Other');

INSERT INTO workspace_memberships (workspace_id, clerk_user_id, role, active) VALUES
('${WORKSPACE_ID}', '${OWNER_USER_ID}', 'owner', true),
('${WORKSPACE_ID}', '${ADMIN_USER_ID}', 'admin', true),
('${WORKSPACE_ID}', '${DEVELOPER_USER_ID}', 'developer', true),
('${WORKSPACE_ID}', '${VIEWER_USER_ID}', 'viewer', true);

INSERT INTO github_installations (
  id,
  workspace_id,
  installation_id,
  permissions_json
) VALUES
(
  '00000000-0000-4000-8000-000000000301',
  '${WORKSPACE_ID}',
  301,
  '{"pull_requests":"write"}'
),
(
  '00000000-0000-4000-8000-000000000302',
  '${OTHER_WORKSPACE_ID}',
  302,
  '{"pull_requests":"write"}'
);

INSERT INTO repositories (
  id,
  installation_id,
  github_repository_id,
  owner,
  name,
  full_name,
  private,
  default_branch,
  enabled
) VALUES
(
  '${REPOSITORY_ID}',
  '00000000-0000-4000-8000-000000000301',
  201,
  'openclaw',
  'firmcode',
  'openclaw/firmcode',
  false,
  'main',
  true
),
(
  '${OTHER_REPOSITORY_ID}',
  '00000000-0000-4000-8000-000000000302',
  202,
  'openclaw',
  'private-fork',
  'openclaw/private-fork',
  true,
  'main',
  true
);
`
  );
}
