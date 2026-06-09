import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const PLATFORM_OVERVIEW_STORE = Symbol("PLATFORM_OVERVIEW_STORE");

export interface PlatformOverviewMetrics {
  readonly totalRegisteredUsers: number;
  readonly totalConnectedRepositories: number;
  readonly totalRevenueUsdCents: number | null;
  readonly totalRevenueStatus: "available" | "unavailable";
}

export interface PlatformOverviewStore {
  getMetrics(): Promise<PlatformOverviewMetrics>;
}

interface PlatformOverviewRow {
  readonly total_registered_users: string | number | null;
  readonly total_connected_repositories: string | number | null;
}

export class EmptyPlatformOverviewStore implements PlatformOverviewStore {
  async getMetrics(): Promise<PlatformOverviewMetrics> {
    return {
      totalRegisteredUsers: 0,
      totalConnectedRepositories: 0,
      totalRevenueUsdCents: null,
      totalRevenueStatus: "unavailable"
    };
  }
}

export class PostgresPlatformOverviewStore implements PlatformOverviewStore {
  constructor(private readonly database: DatabaseExecutor) { }

  async getMetrics(): Promise<PlatformOverviewMetrics> {
    const result = await this.database.query<PlatformOverviewRow>(
      `
SELECT
  (
    SELECT COUNT(
      DISTINCT CASE
        WHEN wm.user_id IS NULL OR wm.user_id = '' THEN wm.user_id
        ELSE wm.user_id
      END
    )
    FROM workspace_memberships wm
  ) AS total_registered_users,
  (
    SELECT COUNT(r.id)
    FROM repositories r
  ) AS total_connected_repositories
`
    );
    const row = result.rows[0];

    return {
      totalRegisteredUsers: toNumber(row?.total_registered_users),
      totalConnectedRepositories: toNumber(row?.total_connected_repositories),
      totalRevenueUsdCents: null,
      totalRevenueStatus: "unavailable"
    };
  }
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === "number" ? value : Number(value);
}
