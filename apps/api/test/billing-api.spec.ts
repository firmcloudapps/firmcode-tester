import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import { PostgresBillingUsageStore } from "../src/modules/billing/billing-usage.store";
import { BillingController } from "../src/modules/billing/billing.controller";
import { BillingService } from "../src/modules/billing/billing.service";
import { PostgresDashboardAuthStore } from "../src/modules/review-runs/dashboard-auth.store";
import type { DashboardRequestContext } from "../src/modules/auth/dashboard-auth.context";

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

describe("billing dashboard API", () => {
  let pool: PgPoolLike;
  let controller: BillingController;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    await seedBillingData(pool);
    controller = new BillingController(
      new BillingService(new PostgresDashboardAuthStore(pool), new PostgresBillingUsageStore(pool))
    );
  });

  afterEach(async () => {
    await pool.end();
  });

  it("allows Admin roles to load InsForge-managed billing context", async () => {
    await expect(controller.getWorkspaceBilling(WORKSPACE_ID, ADMIN_USER_ID, undefined)).resolves.toMatchObject({
      workspace: { role: "admin", canManageBilling: true },
      plan: { status: "active" }
    });
  });

  it("allows InsForge-managed billing capability even when the workspace role is not elevated", async () => {
    await expect(controller.getWorkspaceBilling(WORKSPACE_ID, DEVELOPER_USER_ID, "manage_billing")).resolves.toMatchObject({
      workspace: { role: "developer", canManageBilling: true }
    });
  });

  it("denies Developers without billing capability", async () => {
    await expect(controller.getWorkspaceBilling(WORKSPACE_ID, DEVELOPER_USER_ID, undefined)).rejects.toThrow(
      ForbiddenException
    );
    await expect(controller.getWorkspaceBilling(WORKSPACE_ID, undefined, undefined)).rejects.toThrow(
      UnauthorizedException
    );
  });

  it("does not let spoofed billing capability headers elevate a verified authenticated developer context", async () => {
    await expect(
      controller.getWorkspaceBilling(dashboardAuth({ role: "developer" }), undefined, "manage_billing")
    ).rejects.toThrow(ForbiddenException);
  });
});

function dashboardAuth(overrides: Partial<DashboardRequestContext> = {}): DashboardRequestContext {
  return {
    workspaceId: WORKSPACE_ID,
    userId: DEVELOPER_USER_ID,
    orgId: "org_firmcode",
    sessionId: "sess_test",
    role: "developer",
    capabilities: ["retry_review_run"],
    billingCapabilities: [],
    provider: "insforge",
    ...overrides
  };
}

async function seedBillingData(pool: PgPoolLike): Promise<void> {
  await pool.query(
    `
INSERT INTO workspaces (id, identity_provider_org_id, name) VALUES
('${WORKSPACE_ID}', 'org_firmcode', 'Firmcode');

INSERT INTO user_profiles (id, identity_provider, provider_user_id) VALUES
('${ADMIN_USER_ID}', 'insforge', '${ADMIN_USER_ID}'),
('${DEVELOPER_USER_ID}', 'insforge', '${DEVELOPER_USER_ID}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_memberships (workspace_id, user_id, role, active) VALUES
('${WORKSPACE_ID}', '${ADMIN_USER_ID}', 'admin', true),
('${WORKSPACE_ID}', '${DEVELOPER_USER_ID}', 'developer', true);

INSERT INTO github_installations (id, installation_id, account_login, account_type, workspace_id) VALUES
('00000000-0000-4000-8000-000000000201', 101, 'openclaw', 'Organization', '${WORKSPACE_ID}');

INSERT INTO repositories (id, installation_id, github_repository_id, owner, name, full_name, private, default_branch, enabled) VALUES
('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201', 1001, 'openclaw', 'firmcode', 'openclaw/firmcode', false, 'main', true),
('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000201', 1002, 'openclaw', 'disabled', 'openclaw/disabled', false, 'main', false);

INSERT INTO pull_requests (id, repository_id, github_pr_id, number, title, author_login, base_ref, head_ref, base_sha, head_sha, state) VALUES
('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000301', 2001, 7, 'Add billing shell', 'kelly', 'main', 'billing', 'base', 'head', 'open');

INSERT INTO github_deliveries (delivery_id, event_name, action, installation_id, repository_id, pull_request_number, head_sha, status) VALUES
('billing-delivery-1', 'pull_request', 'opened', 101, 1001, 7, 'head', 'processed'),
('billing-delivery-2', 'pull_request', 'synchronize', 101, 1001, 7, 'head2', 'processed');

INSERT INTO review_runs (id, repository_id, pull_request_id, delivery_id, trigger_event, status, head_sha, metrics_json) VALUES
('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000401', 'billing-delivery-1', 'pull_request.opened', 'succeeded', 'head', '{"tokenUsage": 500}'::jsonb),
('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000401', 'billing-delivery-2', 'pull_request.synchronize', 'succeeded', 'head2', '{"tokenUsage": 1000}'::jsonb);
`
  );
}
