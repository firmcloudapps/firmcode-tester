import { ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import { DashboardAuthorizationService } from "../src/modules/auth/dashboard-authorization.service";
import { PostgresDashboardAuthStore } from "../src/modules/auth/dashboard-auth.store";

interface PgPoolLike {
  query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
}

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000101";
const OTHER_WORKSPACE_ID = "00000000-0000-4000-8000-000000000102";
const OWNER_USER_ID = "user_owner";
const ADMIN_USER_ID = "user_admin";
const DEVELOPER_USER_ID = "user_developer";
const VIEWER_USER_ID = "user_viewer";
const INACTIVE_USER_ID = "user_inactive";

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

describe("dashboard authorization foundation", () => {
  let pool: PgPoolLike;
  let service: DashboardAuthorizationService;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    await seedAuthorizationData(pool);
    service = new DashboardAuthorizationService(new PostgresDashboardAuthStore(pool));
  });

  afterEach(async () => {
    await pool.end();
  });

  it("resolves the active Clerk user, workspace, Clerk organization, and role", async () => {
    const context = await service.requireWorkspaceMembership({
      workspaceId: WORKSPACE_ID,
      clerkUserId: OWNER_USER_ID
    });

    expect(context).toEqual({
      workspaceId: WORKSPACE_ID,
      workspaceName: "Firmcode",
      clerkOrgId: "org_firmcode",
      clerkUserId: OWNER_USER_ID,
      role: "owner"
    });
  });

  it("resolves a Firmcode workspace from the active Clerk organization", async () => {
    const context = await service.requireWorkspaceMembership({
      workspaceId: null,
      clerkOrgId: "org_firmcode",
      clerkUserId: ADMIN_USER_ID
    });

    expect(context.workspaceId).toBe(WORKSPACE_ID);
    expect(context.role).toBe("admin");
  });

  it("denies missing session, missing workspace, unknown workspace, and inactive membership", async () => {
    await expect(service.requireWorkspaceMembership({ workspaceId: WORKSPACE_ID, clerkUserId: null })).rejects.toThrow(
      UnauthorizedException
    );
    await expect(service.requireWorkspaceMembership({ workspaceId: null, clerkUserId: OWNER_USER_ID })).rejects.toThrow(
      UnauthorizedException
    );
    await expect(
      service.requireWorkspaceMembership({
        workspaceId: "00000000-0000-4000-8000-000000009999",
        clerkUserId: OWNER_USER_ID
      })
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.requireWorkspaceMembership({ workspaceId: WORKSPACE_ID, clerkUserId: INACTIVE_USER_ID })
    ).rejects.toThrow(UnauthorizedException);
  });

  it("enforces capability checks from the shared role policy", async () => {
    await expect(
      service.requireWorkspaceMembership({
        workspaceId: WORKSPACE_ID,
        clerkUserId: DEVELOPER_USER_ID
      }, {
        capability: "retry_review_run"
      })
    ).resolves.toMatchObject({
      role: "developer"
    });

    await expect(
      service.requireWorkspaceMembership({
        workspaceId: WORKSPACE_ID,
        clerkUserId: VIEWER_USER_ID
      }, {
        capability: "retry_review_run"
      })
    ).rejects.toThrow(ForbiddenException);
  });

  it("can conceal membership failures for resource-scoped authorization", async () => {
    await expect(
      service.requireWorkspaceMembership(
        {
          workspaceId: OTHER_WORKSPACE_ID,
          clerkUserId: OWNER_USER_ID
        },
        {
          capability: "manage_repository_configuration",
          concealMembershipFailure: true,
          notFoundMessage: "Repository not found"
        }
      )
    ).rejects.toThrow(NotFoundException);
  });
});

async function seedAuthorizationData(pool: PgPoolLike): Promise<void> {
  await pool.query(
    `
INSERT INTO workspaces (id, clerk_org_id, name) VALUES
('${WORKSPACE_ID}', 'org_firmcode', 'Firmcode'),
('${OTHER_WORKSPACE_ID}', 'org_other', 'Other');

INSERT INTO workspace_memberships (workspace_id, clerk_user_id, role, active) VALUES
('${WORKSPACE_ID}', '${OWNER_USER_ID}', 'owner', true),
('${WORKSPACE_ID}', '${ADMIN_USER_ID}', 'admin', true),
('${WORKSPACE_ID}', '${DEVELOPER_USER_ID}', 'developer', true),
('${WORKSPACE_ID}', '${VIEWER_USER_ID}', 'viewer', true),
('${WORKSPACE_ID}', '${INACTIVE_USER_ID}', 'admin', false);
`
  );
}
