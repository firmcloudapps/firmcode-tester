import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import { BillingController } from "../src/modules/billing/billing.controller";
import { BillingService } from "../src/modules/billing/billing.service";
import { PostgresBillingStore } from "../src/modules/billing/billing.store";
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
    controller = new BillingController(
      new BillingService(
        new PostgresBillingStore(pool, () => new Date("2026-05-24T12:00:00.000Z")),
        new PostgresDashboardAuthStore(pool)
      )
    );
  });

  afterEach(async () => {
    await pool.end();
  });

  it("returns Clerk-managed plan placeholders and real workspace usage counters for owners", async () => {
    const billing = await controller.getWorkspaceBilling(WORKSPACE_ID, OWNER_USER_ID, undefined);

    expect(billing).toMatchObject({
      workspace: {
        id: WORKSPACE_ID,
        name: "Firmcode",
        role: "owner",
        canManageBilling: true,
        billingAccessSource: "workspace_role"
      },
      plan: {
        name: "Clerk managed",
        source: "clerk"
      },
      billingStatus: {
        label: "Managed in Clerk",
        source: "clerk"
      },
      usage: {
        monthlyReviewRuns: 1,
        aiTokens: 1800,
        repositories: 2,
        seats: 4,
        periodStart: "2026-05-01T00:00:00.000Z",
        periodEnd: "2026-06-01T00:00:00.000Z"
      }
    });
  });

  it("allows Admins and Clerk-managed billing role holders", async () => {
    const adminBilling = await controller.getWorkspaceBilling(WORKSPACE_ID, ADMIN_USER_ID, undefined);
    const developerBilling = await controller.getWorkspaceBilling(WORKSPACE_ID, DEVELOPER_USER_ID, "billing");

    expect(adminBilling.workspace.role).toBe("admin");
    expect(adminBilling.workspace.canManageBilling).toBe(true);
    expect(developerBilling.workspace.role).toBe("developer");
    expect(developerBilling.workspace.canManageBilling).toBe(true);
    expect(developerBilling.workspace.billingAccessSource).toBe("clerk_billing_role");
  });

  it("requires Clerk dashboard auth headers and elevated billing access", async () => {
    await expect(controller.getWorkspaceBilling(WORKSPACE_ID, undefined, undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.getWorkspaceBilling(undefined, OWNER_USER_ID, undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.getWorkspaceBilling(WORKSPACE_ID, "user_missing", undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.getWorkspaceBilling(WORKSPACE_ID, VIEWER_USER_ID, undefined)).rejects.toThrow(ForbiddenException);
    await expect(controller.getWorkspaceBilling(WORKSPACE_ID, DEVELOPER_USER_ID, undefined)).rejects.toThrow(ForbiddenException);
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
('${WORKSPACE_ID}', '${VIEWER_USER_ID}', 'viewer', true),
('${WORKSPACE_ID}', 'user_inactive', 'viewer', false);

INSERT INTO github_installations (
  id,
  workspace_id,
  installation_id,
  account_login,
  account_type,
  permissions_json
) VALUES
(
  '00000000-0000-4000-8000-000000000201',
  '${WORKSPACE_ID}',
  201,
  'openclaw',
  'Organization',
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
  '00000000-0000-4000-8000-000000000211',
  '00000000-0000-4000-8000-000000000201',
  211,
  'openclaw',
  'firmcode',
  'openclaw/firmcode',
  false,
  'main',
  true
),
(
  '00000000-0000-4000-8000-000000000212',
  '00000000-0000-4000-8000-000000000201',
  212,
  'openclaw',
  'infra',
  'openclaw/infra',
  true,
  'main',
  true
);

INSERT INTO pull_requests (
  id,
  repository_id,
  github_pr_id,
  number,
  title,
  author_login,
  base_ref,
  head_ref,
  base_sha,
  head_sha,
  state,
  draft
) VALUES
(
  '00000000-0000-4000-8000-000000000221',
  '00000000-0000-4000-8000-000000000211',
  221,
  7,
  'Add billing dashboard',
  'kelly',
  'main',
  'feature/billing',
  'base-sha',
  'head-sha',
  'open',
  false
);

INSERT INTO github_deliveries (delivery_id, event_name, action) VALUES
('delivery-current-month', 'pull_request', 'opened'),
('delivery-previous-month', 'pull_request', 'synchronize');

INSERT INTO review_runs (
  id,
  repository_id,
  pull_request_id,
  delivery_id,
  trigger_event,
  head_sha,
  status,
  metrics_json,
  created_at,
  updated_at
) VALUES
(
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000211',
  '00000000-0000-4000-8000-000000000221',
  'delivery-current-month',
  'pull_request.opened',
  'head-sha',
  'succeeded',
  '{"tokenUsage":1800}',
  '2026-05-22T10:00:00.000Z',
  '2026-05-22T10:01:00.000Z'
),
(
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000211',
  '00000000-0000-4000-8000-000000000221',
  'delivery-previous-month',
  'pull_request.synchronize',
  'head-sha',
  'succeeded',
  '{"tokenUsage":900}',
  '2026-04-22T10:00:00.000Z',
  '2026-04-22T10:01:00.000Z'
);
`
  );
}
