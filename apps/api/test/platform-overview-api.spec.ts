import { ForbiddenException } from "@nestjs/common";
import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import type { DashboardRequestContext } from "../src/modules/auth/dashboard-auth.context";
import { PlatformOverviewController } from "../src/modules/platform-overview/platform-overview.controller";
import { PlatformOverviewService } from "../src/modules/platform-overview/platform-overview.service";
import { PostgresPlatformOverviewStore } from "../src/modules/platform-overview/platform-overview.store";

interface PgPoolLike {
  query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
}

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000101";
const ADMIN_USER_ID = "user_admin";
const DEVELOPER_USER_ID = "user_developer";

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

describe("platform overview API", () => {
  let pool: PgPoolLike;
  let controller: PlatformOverviewController;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    await seedPlatformOverviewData(pool);
    controller = new PlatformOverviewController(
      new PlatformOverviewService(new PostgresPlatformOverviewStore(pool))
    );
  });

  afterEach(async () => {
    await pool.end();
  });

  it("returns platform KPI metrics for admins", async () => {
    await expect(controller.getOverview(dashboardAuth({ role: "admin", userId: ADMIN_USER_ID }))).resolves.toMatchObject({
      metrics: {
        totalRegisteredUsers: 3,
        totalConnectedRepositories: 2,
        totalRevenueUsdCents: null,
        totalRevenueStatus: "unavailable"
      }
    });
  });

  it("blocks developers from admin-only platform metrics", async () => {
    await expect(
      controller.getOverview(dashboardAuth({ role: "developer", userId: DEVELOPER_USER_ID }))
    ).rejects.toThrow(ForbiddenException);
  });
});

function dashboardAuth(overrides: Partial<DashboardRequestContext> = {}): DashboardRequestContext {
  return {
    userId: ADMIN_USER_ID,
    workspaceId: WORKSPACE_ID,
    orgId: "org_firmcode",
    sessionId: "sess_platform",
    role: "admin",
    capabilities: ["manage_sensitive_settings", "manage_billing", "manage_github_installations", "manage_review_policies"],
    billingCapabilities: [],
    provider: "insforge",
    clerkUserId: ADMIN_USER_ID,
    clerkOrgId: "org_firmcode",
    clerkCapabilities: [],
    ...overrides
  };
}

async function seedPlatformOverviewData(pool: PgPoolLike): Promise<void> {
  await pool.query(
    `
INSERT INTO workspaces (id, clerk_org_id, name) VALUES
('${WORKSPACE_ID}', 'org_firmcode', 'Firmcode'),
('00000000-0000-4000-8000-000000000102', 'org_customer', 'Customer Workspace');

INSERT INTO workspace_memberships (workspace_id, clerk_user_id, role, active) VALUES
('${WORKSPACE_ID}', '${ADMIN_USER_ID}', 'admin', true),
('${WORKSPACE_ID}', 'user_support_admin', 'admin', true),
('00000000-0000-4000-8000-000000000102', '${DEVELOPER_USER_ID}', 'developer', true);

INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type) VALUES
('00000000-0000-4000-8000-000000000201', '${WORKSPACE_ID}', 301, 'openclaw', 'Organization'),
('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000102', 302, 'customer', 'User');

INSERT INTO repositories (id, installation_id, github_repository_id, owner, name, full_name, private, default_branch, enabled) VALUES
('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201', 1001, 'openclaw', 'firmcode', 'openclaw/firmcode', false, 'main', true),
('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000202', 1002, 'customer', 'private-app', 'customer/private-app', true, 'main', true);
`
  );
}
