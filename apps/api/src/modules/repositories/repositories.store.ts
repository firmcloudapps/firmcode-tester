import type {
  DashboardRepositoryListFilters,
  RepositoryReviewConfiguration,
  RepositoryLastReview,
  RepositoryListItem,
  RepositoryListResponse,
  UpdateRepositoryReviewConfigurationRequest,
  ReviewRunStatus
} from "@firmcode/shared";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const REPOSITORIES_STORE = Symbol("REPOSITORIES_STORE");

export interface RepositoriesStore {
  listRepositories(filters: DashboardRepositoryListFilters): Promise<RepositoryListResponse>;
  getRepositoryConfiguration(input: RepositoryConfigurationLookup): Promise<RepositoryReviewConfiguration | null>;
  updateRepositoryConfiguration(input: RepositoryConfigurationUpdate): Promise<RepositoryReviewConfiguration | null>;
}

export interface RepositoryConfigurationLookup {
  readonly repositoryId: string;
  readonly workspaceId: string;
}

export interface RepositoryConfigurationUpdate extends RepositoryConfigurationLookup {
  readonly updates: UpdateRepositoryReviewConfigurationRequest;
  readonly updatedByClerkUserId: string;
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

interface RepositoryConfigurationRow {
  readonly repository_id: string;
  readonly automation_enabled: boolean;
  readonly draft_pr_reviews_enabled: boolean;
  readonly max_inline_comments: number;
  readonly severity_threshold: RepositoryReviewConfiguration["severityThreshold"];
  readonly semgrep_enabled: boolean;
  readonly tree_sitter_enabled: boolean;
  readonly ci_explanation_enabled: boolean;
  readonly infrastructure_review_enabled: boolean;
  readonly dry_run_enabled: boolean;
  readonly updated_by_clerk_user_id: string | null;
  readonly created_at: Date | string | null;
  readonly updated_at: Date | string | null;
}

export class EmptyRepositoriesStore implements RepositoriesStore {
  async listRepositories(filters: DashboardRepositoryListFilters): Promise<RepositoryListResponse> {
    return { repositories: [], filters };
  }

  async getRepositoryConfiguration(_input: RepositoryConfigurationLookup): Promise<RepositoryReviewConfiguration | null> {
    return null;
  }

  async updateRepositoryConfiguration(_input: RepositoryConfigurationUpdate): Promise<RepositoryReviewConfiguration | null> {
    return null;
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

  async getRepositoryConfiguration(input: RepositoryConfigurationLookup): Promise<RepositoryReviewConfiguration | null> {
    const owned = await this.repositoryBelongsToWorkspace(input);

    if (!owned) {
      return null;
    }

    const row = await this.ensureRepositoryConfiguration(input.repositoryId);
    return toRepositoryReviewConfiguration(row);
  }

  async updateRepositoryConfiguration(input: RepositoryConfigurationUpdate): Promise<RepositoryReviewConfiguration | null> {
    const owned = await this.repositoryBelongsToWorkspace(input);

    if (!owned) {
      return null;
    }

    await this.ensureRepositoryConfiguration(input.repositoryId);

    const assignments = buildConfigurationAssignments(input.updates);
    const values: unknown[] = [input.repositoryId, input.updatedByClerkUserId, ...assignments.values];
    const result = await this.database.query<RepositoryConfigurationRow>(
      `
UPDATE repository_review_configurations
SET updated_by_clerk_user_id = $2,
    updated_at = now()
    ${assignments.sql}
WHERE repository_id = $1
RETURNING *
`,
      values
    );
    const row = result.rows[0];

    if (row === undefined) {
      return null;
    }

    if (input.updates.automationEnabled !== undefined) {
      await this.database.query(
        `
UPDATE repositories
SET enabled = $2,
    updated_at = now()
WHERE id = $1
`,
        [input.repositoryId, input.updates.automationEnabled]
      );
    }

    return toRepositoryReviewConfiguration(row);
  }

  private async repositoryBelongsToWorkspace(input: RepositoryConfigurationLookup): Promise<boolean> {
    const result = await this.database.query<{ id: string }>(
      `
SELECT r.id
FROM repositories r
JOIN github_installations gi ON gi.id = r.installation_id
WHERE r.id = $1
  AND gi.workspace_id = $2
`,
      [input.repositoryId, input.workspaceId]
    );

    return result.rows[0] !== undefined;
  }

  private async ensureRepositoryConfiguration(repositoryId: string): Promise<RepositoryConfigurationRow> {
    const result = await this.database.query<RepositoryConfigurationRow>(
      `
INSERT INTO repository_review_configurations (
  repository_id,
  automation_enabled
)
SELECT
  id,
  enabled
FROM repositories
WHERE id = $1
ON CONFLICT (repository_id) DO UPDATE
SET automation_enabled = repository_review_configurations.automation_enabled
RETURNING *
`,
      [repositoryId]
    );
    const row = result.rows[0];

    if (row === undefined) {
      throw new Error("Repository configuration could not be created");
    }

    return row;
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

function buildConfigurationAssignments(updates: UpdateRepositoryReviewConfigurationRequest): { sql: string; values: unknown[] } {
  const assignments: string[] = [];
  const values: unknown[] = [];
  const append = (column: string, value: unknown) => {
    values.push(value);
    assignments.push(`${column} = $${values.length + 2}`);
  };

  if (updates.automationEnabled !== undefined) {
    append("automation_enabled", updates.automationEnabled);
  }

  if (updates.draftPullRequestReviewsEnabled !== undefined) {
    append("draft_pr_reviews_enabled", updates.draftPullRequestReviewsEnabled);
  }

  if (updates.maxInlineComments !== undefined) {
    append("max_inline_comments", updates.maxInlineComments);
  }

  if (updates.severityThreshold !== undefined) {
    append("severity_threshold", updates.severityThreshold);
  }

  if (updates.semgrepEnabled !== undefined) {
    append("semgrep_enabled", updates.semgrepEnabled);
  }

  if (updates.treeSitterEnabled !== undefined) {
    append("tree_sitter_enabled", updates.treeSitterEnabled);
  }

  if (updates.ciExplanationEnabled !== undefined) {
    append("ci_explanation_enabled", updates.ciExplanationEnabled);
  }

  if (updates.infrastructureReviewEnabled !== undefined) {
    append("infrastructure_review_enabled", updates.infrastructureReviewEnabled);
  }

  if (updates.dryRunEnabled !== undefined) {
    append("dry_run_enabled", updates.dryRunEnabled);
  }

  return {
    sql: assignments.length === 0 ? "" : `,\n    ${assignments.join(",\n    ")}`,
    values
  };
}

function toRepositoryReviewConfiguration(row: RepositoryConfigurationRow): RepositoryReviewConfiguration {
  return {
    repositoryId: row.repository_id,
    automationEnabled: row.automation_enabled,
    draftPullRequestReviewsEnabled: row.draft_pr_reviews_enabled,
    maxInlineComments: Number(row.max_inline_comments),
    severityThreshold: row.severity_threshold,
    semgrepEnabled: row.semgrep_enabled,
    treeSitterEnabled: row.tree_sitter_enabled,
    ciExplanationEnabled: row.ci_explanation_enabled,
    infrastructureReviewEnabled: row.infrastructure_review_enabled,
    dryRunEnabled: row.dry_run_enabled,
    updatedByClerkUserId: row.updated_by_clerk_user_id,
    createdAt: toRequiredIsoString(row.created_at),
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
