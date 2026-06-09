import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const BILLING_USAGE_STORE = Symbol("BILLING_USAGE_STORE");

export interface WorkspaceBillingUsageCounters {
  readonly reviewRunsThisMonth: number | null;
  readonly aiTokensThisMonth: number | null;
  readonly repositoriesMonitored: number | null;
  readonly seats: number | null;
}

export interface BillingUsageStore {
  getWorkspaceUsage(workspaceId: string): Promise<WorkspaceBillingUsageCounters>;
}

interface WorkspaceBillingUsageRow {
  readonly review_runs_this_month: string | number | null;
  readonly ai_tokens_this_month: string | number | null;
  readonly repositories_monitored: string | number | null;
  readonly seats: string | number | null;
}

export class EmptyBillingUsageStore implements BillingUsageStore {
  async getWorkspaceUsage(_workspaceId: string): Promise<WorkspaceBillingUsageCounters> {
    return {
      reviewRunsThisMonth: null,
      aiTokensThisMonth: null,
      repositoriesMonitored: null,
      seats: null
    };
  }
}

export class PostgresBillingUsageStore implements BillingUsageStore {
  constructor(private readonly database: DatabaseExecutor) {}

  async getWorkspaceUsage(workspaceId: string): Promise<WorkspaceBillingUsageCounters> {
    const monthStart = getCurrentMonthStart();
    const result = await this.database.query<WorkspaceBillingUsageRow>(
      `
SELECT
  (
    SELECT COUNT(rr.id)
    FROM review_runs rr
    JOIN repositories r ON r.id = rr.repository_id
    JOIN github_installations gi ON gi.id = r.installation_id
    WHERE gi.workspace_id = $1
      AND rr.created_at >= $2
  ) AS review_runs_this_month,
  (
    SELECT COALESCE(SUM(COALESCE((rr.metrics_json->>'tokenUsage')::bigint, 0)), 0)
    FROM review_runs rr
    JOIN repositories r ON r.id = rr.repository_id
    JOIN github_installations gi ON gi.id = r.installation_id
    WHERE gi.workspace_id = $1
      AND rr.created_at >= $2
  ) AS ai_tokens_this_month,
  (
    SELECT COUNT(r.id)
    FROM repositories r
    JOIN github_installations gi ON gi.id = r.installation_id
    WHERE gi.workspace_id = $1
      AND r.enabled = true
  ) AS repositories_monitored,
  (
    SELECT COUNT(wm.user_id)
    FROM workspace_memberships wm
    WHERE wm.workspace_id = $1
      AND wm.active = true
  ) AS seats
`,
      [workspaceId, monthStart]
    );

    const row = result.rows[0];

    return {
      reviewRunsThisMonth: toNullableNumber(row?.review_runs_this_month),
      aiTokensThisMonth: toNullableNumber(row?.ai_tokens_this_month),
      repositoriesMonitored: toNullableNumber(row?.repositories_monitored),
      seats: toNullableNumber(row?.seats)
    };
  }
}

function getCurrentMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function toNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "number" ? value : Number(value);
}
