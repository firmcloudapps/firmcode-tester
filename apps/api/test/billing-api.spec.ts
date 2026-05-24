import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import { BillingController } from "../src/modules/billing/billing.controller";
import { BillingService } from "../src/modules/billing/billing.service";
import { PostgresDashboardAuthStore } from "../src/modules/review-runs/dashboard-auth.store";

interface PgPoolLike {
  query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
}

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000101";
const OWNER_USER_ID = "user_owner";
const ADMIN_USER_ID = "user_admin";
const DEVELOPER_USER_ID = "user_developer";
const VIEWER_USER_ID = "user_viewer";

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

describe("billing dashboard API", () => {
  let pool: PgPoolLike;
  let controller: BillingController;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    await seedBillingData(pool);
    controller = new BillingController(new BillingService(new PostgresDashboardAuthStore(pool)));
  });

  afterEach(async () => {
    await pool.end();
  });

  it("allows Owner and Admin roles to load Clerk-managed billing context", async () => {
    await expect(controller.getWorkspaceBilling(WORKSPACE_ID, OWNER_USER_ID, undefined)).resolves.toMatchObject({
      workspace: { role: "owner", canManageBilling: true },
      plan: { status: "managed_by_clerk" }
    });
    await expect(controller.getWorkspaceBilling(WORKSPACE_ID, ADMIN_USER_ID, undefined)).resolves.toMatchObject({
      workspace: { role: "admin", canManageBilling: true }
    });
  });

  it("allows Clerk-managed billing capability even when the workspace role is not elevated", async () => {
    await expect(controller.getWorkspaceBilling(WORKSPACE_ID, DEVELOPER_USER_ID, "manage_billing")).resolves.toMatchObject({
      workspace: { role: "developer", canManageBilling: true }
    });
  });

  it("denies lower roles without Clerk billing capability", async () => {
    await expect(controller.getWorkspaceBilling(WORKSPACE_ID, DEVELOPER_USER_ID, undefined)).rejects.toThrow(
      ForbiddenException
    );
    await expect(controller.getWorkspaceBilling(WORKSPACE_ID, VIEWER_USER_ID, undefined)).rejects.toThrow(
      ForbiddenException
    );
    await expect(controller.getWorkspaceBilling(WORKSPACE_ID, undefined, undefined)).rejects.toThrow(
      UnauthorizedException
    );
  });
});

async function seedBillingData(pool: PgPoolLike): Promise<void> {
  await pool.query(
    `
INSERT INTO workspaces (id, clerk_org_id, name) VALUES
('${WORKSPACE_ID}', 'org_firmcode', 'Firmcode');

INSERT INTO workspace_memberships (workspace_id, clerk_user_id, role, active) VALUES
('${WORKSPACE_ID}', '${OWNER_USER_ID}', 'owner', true),
('${WORKSPACE_ID}', '${ADMIN_USER_ID}', 'admin', true),
('${WORKSPACE_ID}', '${DEVELOPER_USER_ID}', 'developer', true),
('${WORKSPACE_ID}', '${VIEWER_USER_ID}', 'viewer', true);
`
  );
}
