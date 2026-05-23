import {
  canManageWorkspaceBilling,
  type DashboardWorkspaceRole,
  type WorkspaceBillingResponse,
  type WorkspaceBillingUsage
} from "@firmcode/shared";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const BILLING_STORE = Symbol("BILLING_STORE");

export interface BillingStore {
  getWorkspaceBilling(input: WorkspaceBillingLookup): Promise<WorkspaceBillingResponse | null>;
}

export interface WorkspaceBillingLookup {
  readonly workspaceId: string;
  readonly role: DashboardWorkspaceRole;
  readonly hasClerkManagedBillingRole: boolean;
}

interface WorkspaceRow {
  readonly id: string;
  readonly name: string;
}

interface CountRow {
  readonly count: string | number;
}

interface ReviewRunUsageRow {
  readonly metrics_json: unknown;
}

export class EmptyBillingStore implements BillingStore {
  async getWorkspaceBilling(input: WorkspaceBillingLookup): Promise<WorkspaceBillingResponse | null> {
    return buildBillingResponse({
      workspace: {
        id: input.workspaceId,
        name: "Test workspace"
      },
      role: input.role,
      hasClerkManagedBillingRole: input.hasClerkManagedBillingRole,
      usage: {
        monthlyReviewRuns: 0,
        aiTokens: 0,
        repositories: 0,
        seats: 0,
        periodStart: null,
        periodEnd: null
      }
    });
  }
}

export class PostgresBillingStore implements BillingStore {
  constructor(
    private readonly database: DatabaseExecutor,
    private readonly now: () => Date = () => new Date()
  ) {}

  async getWorkspaceBilling(input: WorkspaceBillingLookup): Promise<WorkspaceBillingResponse | null> {
    const workspace = await this.loadWorkspace(input.workspaceId);

    if (workspace === null) {
      return null;
    }

    const period = getCurrentMonthPeriod(this.now());
    const [repositories, seats, reviewRunRows] = await Promise.all([
      this.countRepositories(input.workspaceId),
      this.countSeats(input.workspaceId),
      this.loadMonthlyReviewRunUsage(input.workspaceId, period.start, period.end)
    ]);

    return buildBillingResponse({
      workspace,
      role: input.role,
      hasClerkManagedBillingRole: input.hasClerkManagedBillingRole,
      usage: {
        monthlyReviewRuns: reviewRunRows.length,
        aiTokens: sumTokenUsage(reviewRunRows),
        repositories,
        seats,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString()
      }
    });
  }

  private async loadWorkspace(workspaceId: string): Promise<WorkspaceRow | null> {
    const result = await this.database.query<WorkspaceRow>(
      `
SELECT id, name
FROM workspaces
WHERE id = $1
`,
      [workspaceId]
    );

    return result.rows[0] ?? null;
  }

  private async countRepositories(workspaceId: string): Promise<number> {
    const result = await this.database.query<CountRow>(
      `
SELECT COUNT(r.id) AS count
FROM github_installations gi
LEFT JOIN repositories r ON r.installation_id = gi.id
WHERE gi.workspace_id = $1
`,
      [workspaceId]
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  private async countSeats(workspaceId: string): Promise<number> {
    const result = await this.database.query<CountRow>(
      `
SELECT COUNT(*) AS count
FROM workspace_memberships
WHERE workspace_id = $1
  AND active = true
`,
      [workspaceId]
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  private async loadMonthlyReviewRunUsage(
    workspaceId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<ReviewRunUsageRow[]> {
    const result = await this.database.query<ReviewRunUsageRow>(
      `
SELECT rr.metrics_json
FROM review_runs rr
JOIN repositories r ON r.id = rr.repository_id
JOIN github_installations gi ON gi.id = r.installation_id
WHERE gi.workspace_id = $1
  AND rr.created_at >= $2
  AND rr.created_at < $3
`,
      [workspaceId, periodStart, periodEnd]
    );

    return result.rows;
  }
}

function buildBillingResponse(input: {
  readonly workspace: WorkspaceRow;
  readonly role: DashboardWorkspaceRole;
  readonly hasClerkManagedBillingRole: boolean;
  readonly usage: WorkspaceBillingUsage;
}): WorkspaceBillingResponse {
  return {
    workspace: {
      id: input.workspace.id,
      name: input.workspace.name,
      role: input.role,
      canManageBilling: canManageWorkspaceBilling(input.role, input.hasClerkManagedBillingRole),
      billingAccessSource:
        input.role === "owner" || input.role === "admin" ? "workspace_role" : "clerk_billing_role"
    },
    plan: {
      name: "Clerk managed",
      source: "clerk",
      description: "Plan, checkout, seats, invoices, and subscription mutations stay in Clerk Billing."
    },
    billingStatus: {
      label: "Managed in Clerk",
      source: "clerk"
    },
    usage: input.usage
  };
}

function getCurrentMonthPeriod(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

  return { start, end };
}

function sumTokenUsage(rows: readonly ReviewRunUsageRow[]): number {
  return rows.reduce((total, row) => total + readTokenUsage(row.metrics_json), 0);
}

function readTokenUsage(value: unknown): number {
  if (value === null || typeof value !== "object") {
    return 0;
  }

  const tokenUsage = (value as { tokenUsage?: unknown }).tokenUsage;

  return typeof tokenUsage === "number" && Number.isFinite(tokenUsage) ? tokenUsage : 0;
}
