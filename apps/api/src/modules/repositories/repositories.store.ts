import type {
  DashboardRepositoryListFilters,
  RepositoryLastReview,
  RepositoryListItem,
  RepositoryListResponse,
  ReviewRunStatus
} from "@firmcode/shared";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const REPOSITORIES_STORE = Symbol("REPOSITORIES_STORE");

export interface RepositoriesStore {
  listRepositories(filters: DashboardRepositoryListFilters): Promise<RepositoryListResponse>;
}

interface RepositoryListRow {
  readonly id: string;
  readonly owner: string;
  readonly name: string;
  readonly full_name: string;
  readonly private: boolean;
  readonly default_branch: string;
  readonly enabled: boolean;
  readonly updated_at: Date | string | null;
}

interface RepositoryReviewRunRow {
  readonly repository_id: string;
  readonly review_run_id: string;
  readonly status: ReviewRunStatus;
  readonly head_sha: string;
  readonly created_at: Date | string | null;
  readonly finished_at: Date | string | null;
  readonly pull_request_number: number;
  readonly pull_request_title: string;
}

interface RepositoryChangedFileRow {
  readonly repository_id: string;
  readonly language: string | null;
}

interface RepositoryFindingRow {
  readonly repository_id: string;
  readonly finding_id: string;
}

export class EmptyRepositoriesStore implements RepositoriesStore {
  async listRepositories(filters: DashboardRepositoryListFilters): Promise<RepositoryListResponse> {
    return { repositories: [], filters };
  }
}

export class PostgresRepositoriesStore implements RepositoriesStore {
  constructor(private readonly database: DatabaseExecutor) {}

  async listRepositories(filters: DashboardRepositoryListFilters): Promise<RepositoryListResponse> {
    const { whereSql, values } = buildRepositoryWhereClause(filters);
    const result = await this.database.query<RepositoryListRow>(
      `
SELECT
  r.id,
  r.owner,
  r.name,
  r.full_name,
  r.private,
  r.default_branch,
  r.enabled,
  r.updated_at
FROM repositories r
${whereSql}
ORDER BY r.full_name ASC
LIMIT 100
`,
      values
    );
    const reviewRuns = await this.database.query<RepositoryReviewRunRow>(
      `
SELECT
  rr.repository_id,
  rr.id AS review_run_id,
  rr.status,
  rr.head_sha,
  rr.created_at,
  rr.finished_at,
  pr.number AS pull_request_number,
  pr.title AS pull_request_title
FROM review_runs rr
JOIN pull_requests pr ON pr.id = rr.pull_request_id
ORDER BY rr.created_at DESC
`
    );
    const changedFiles = await this.database.query<RepositoryChangedFileRow>(
      `
SELECT
  rr.repository_id,
  cf.language
FROM changed_files cf
JOIN review_runs rr ON rr.id = cf.review_run_id
WHERE cf.language IS NOT NULL
ORDER BY cf.created_at DESC
`
    );
    const findings = await this.database.query<RepositoryFindingRow>(
      `
SELECT
  rr.repository_id,
  f.id AS finding_id
FROM findings f
JOIN review_runs rr ON rr.id = f.review_run_id
`
    );
    const aggregates = buildRepositoryAggregates(reviewRuns.rows, changedFiles.rows, findings.rows);
    const repositories = result.rows
      .map((row) => toRepositoryListItem(row, aggregates.get(row.id)))
      .filter((repository) => {
        return filters.language === undefined || repository.primaryLanguage?.toLowerCase() === filters.language.toLowerCase();
      });

    return {
      repositories,
      filters
    };
  }
}

function buildRepositoryWhereClause(filters: DashboardRepositoryListFilters): { whereSql: string; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.enabled !== undefined) {
    values.push(filters.enabled);
    conditions.push(`r.enabled = $${values.length}`);
  }

  if (filters.private !== undefined) {
    values.push(filters.private);
    conditions.push(`r.private = $${values.length}`);
  }

  return {
    whereSql: conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`,
    values
  };
}

interface RepositoryAggregate {
  primaryLanguage: string | null;
  openFindingsCount: number;
  lastReview: RepositoryLastReview | null;
}

function buildRepositoryAggregates(
  reviewRuns: RepositoryReviewRunRow[],
  changedFiles: RepositoryChangedFileRow[],
  findings: RepositoryFindingRow[]
): Map<string, RepositoryAggregate> {
  const aggregates = new Map<string, RepositoryAggregate>();

  for (const reviewRun of reviewRuns) {
    const aggregate = ensureAggregate(aggregates, reviewRun.repository_id);

    if (aggregate.lastReview === null) {
      aggregate.lastReview = {
        reviewRunId: reviewRun.review_run_id,
        pullRequestNumber: reviewRun.pull_request_number,
        pullRequestTitle: reviewRun.pull_request_title,
        status: reviewRun.status,
        headSha: reviewRun.head_sha,
        createdAt: toRequiredIsoString(reviewRun.created_at),
        finishedAt: toIsoString(reviewRun.finished_at)
      };
    }
  }

  for (const changedFile of changedFiles) {
    if (changedFile.language !== null) {
      const aggregate = ensureAggregate(aggregates, changedFile.repository_id);
      aggregate.primaryLanguage ??= changedFile.language;
    }
  }

  for (const finding of findings) {
    ensureAggregate(aggregates, finding.repository_id).openFindingsCount += 1;
  }

  return aggregates;
}

function ensureAggregate(aggregates: Map<string, RepositoryAggregate>, repositoryId: string): RepositoryAggregate {
  const existing = aggregates.get(repositoryId);

  if (existing !== undefined) {
    return existing;
  }

  const aggregate: RepositoryAggregate = {
    primaryLanguage: null,
    openFindingsCount: 0,
    lastReview: null
  };
  aggregates.set(repositoryId, aggregate);

  return aggregate;
}

function toRepositoryListItem(row: RepositoryListRow, aggregate: RepositoryAggregate | undefined): RepositoryListItem {
  return {
    id: row.id,
    owner: row.owner,
    name: row.name,
    fullName: row.full_name,
    private: row.private,
    defaultBranch: row.default_branch,
    enabled: row.enabled,
    primaryLanguage: aggregate?.primaryLanguage ?? null,
    openFindingsCount: aggregate?.openFindingsCount ?? 0,
    lastReview: aggregate?.lastReview ?? null,
    updatedAt: toRequiredIsoString(row.updated_at)
  };
}

function toIsoString(value: Date | string | null): string | null {
  return value === null ? null : toRequiredIsoString(value);
}

function toRequiredIsoString(value: Date | string | null): string {
  if (value === null) {
    return new Date(0).toISOString();
  }

  return typeof value === "string" ? new Date(value).toISOString() : value.toISOString();
}
