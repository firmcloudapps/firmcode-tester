import type {
  DashboardRepositoryListFilters,
  CodebaseScanFindingInboxItem,
  CodebaseScanRunListItem,
  CodebaseScanStatus,
  CodebaseScanTrigger,
  FindingInboxItem,
  RepositoryActivityItem,
  RepositoryActivityResponse,
  RepositoryDetailPermissions,
  RepositoryDetailResponse,
  RepositoryCodebaseScanSummary,
  RepositoryReviewConfiguration,
  RepositoryLastReview,
  RepositoryListItem,
  RepositoryListResponse,
  RepositoryPullRequestSummary,
  ReviewFindingCategory,
  ReviewFindingConfidence,
  ReviewFindingSeverity,
  ReviewFindingSource,
  ReviewFindingStatus,
  ReviewRunListItem,
  ReviewRunRiskLevel,
  UpdateRepositoryReviewConfigurationRequest,
  ReviewRunStatus
} from "@firmcode/shared";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";
import {
  appendOwnPullRequestActivityCondition,
  buildRepositoryAccessClause,
  FULL_REPOSITORY_ACCESS_SCOPE,
  type RepositoryAccessScope
} from "../auth/repository-access-scope";

export const REPOSITORIES_STORE = Symbol("REPOSITORIES_STORE");

type RepositoryListLookup = DashboardRepositoryListFilters & {
  readonly workspaceId?: string;
  readonly accessScope?: RepositoryAccessScope;
};

export interface RepositoriesStore {
  listRepositories(filters: RepositoryListLookup): Promise<RepositoryListResponse>;
  getRepositoryDetail(input: RepositoryDetailLookup): Promise<RepositoryDetailResponse | null>;
  listRepositoryActivity(input: RepositoryActivityLookup): Promise<RepositoryActivityResponse | null>;
  getRepositoryConfiguration(input: RepositoryConfigurationLookup): Promise<RepositoryReviewConfiguration | null>;
  updateRepositoryConfiguration(input: RepositoryConfigurationUpdate): Promise<RepositoryReviewConfiguration | null>;
}

export interface RepositoryConfigurationLookup {
  readonly repositoryId: string;
  readonly workspaceId: string;
  readonly accessScope?: RepositoryAccessScope;
}

export interface RepositoryDetailLookup extends RepositoryConfigurationLookup {
  readonly permissions: RepositoryDetailPermissions;
}

export interface RepositoryActivityLookup extends RepositoryConfigurationLookup { }

export interface RepositoryConfigurationUpdate extends RepositoryConfigurationLookup {
  readonly updates: UpdateRepositoryReviewConfigurationRequest;
  readonly updatedByUserId: string;
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

interface RepositoryCodebaseScanAggregateRow {
  readonly repository_id: string;
  readonly latest_scan_run_id: string | null;
  readonly latest_scan_status: CodebaseScanStatus | null;
  readonly latest_scan_trigger: CodebaseScanTrigger | null;
  readonly latest_scan_commit_sha: string | null;
  readonly latest_scan_started_at: Date | string | null;
  readonly latest_scan_finished_at: Date | string | null;
  readonly latest_scan_created_at: Date | string | null;
  readonly open_codebase_findings_count: string | number;
}

interface RepositoryPullRequestRow {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly author_login: string;
  readonly base_ref: string;
  readonly head_ref: string;
  readonly state: string;
  readonly draft: boolean;
  readonly updated_at: Date | string | null;
}

interface RepositoryDetailReviewRunRow {
  readonly id: string;
  readonly repository_id: string;
  readonly pull_request_id: string;
  readonly repository_full_name: string;
  readonly pull_request_number: number;
  readonly pull_request_title: string;
  readonly pull_request_author: string;
  readonly trigger_event: string;
  readonly head_sha: string;
  readonly status: ReviewRunStatus;
  readonly started_at: Date | string | null;
  readonly finished_at: Date | string | null;
  readonly metrics_json: unknown;
  readonly created_at: Date | string | null;
  readonly updated_at: Date | string | null;
}

interface RepositoryFindingInboxRow {
  readonly id: string;
  readonly review_run_id: string;
  readonly repository_id: string;
  readonly repository_full_name: string;
  readonly pull_request_number: number;
  readonly pull_request_title: string;
  readonly source: ReviewFindingSource;
  readonly category: ReviewFindingCategory;
  readonly severity: ReviewFindingSeverity;
  readonly confidence: ReviewFindingConfidence;
  readonly file_path: string | null;
  readonly start_line: number | null;
  readonly end_line: number | null;
  readonly title: string;
  readonly body: string;
  readonly evidence_json: unknown;
  readonly suggestion: string | null;
  readonly dedupe_key: string;
  readonly post_as_inline: boolean;
  readonly finding_created_at: Date | string | null;
  readonly review_run_created_at: Date | string | null;
  readonly posted_at: Date | string | null;
  readonly github_comment_id: string | number | null;
}

interface ReviewRunCountRow {
  readonly review_run_id: string;
  readonly count: string | number;
}

interface RepositoryActivityRow {
  readonly id: string;
  readonly kind: RepositoryActivityItem["kind"];
  readonly title: string;
  readonly detail: string;
  readonly created_at: Date | string | null;
}

interface RepositoryConfigurationRow {
  readonly repository_id: string;
  readonly automation_enabled: boolean;
  readonly codebase_scan_enabled: boolean;
  readonly codebase_scan_cadence_hours: number;
  readonly codebase_scan_ignored_paths_json: unknown;
  readonly codebase_scan_severity_threshold: RepositoryReviewConfiguration["codebaseScanSeverityThreshold"];
  readonly codebase_scan_max_files: number;
  readonly codebase_scan_max_bytes: number;
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

interface RepositoryCodebaseScanRunRow {
  readonly id: string;
  readonly repository_id: string;
  readonly repository_full_name: string;
  readonly trigger: CodebaseScanTrigger;
  readonly default_branch: string;
  readonly commit_sha: string | null;
  readonly status: CodebaseScanStatus;
  readonly started_at: Date | string | null;
  readonly finished_at: Date | string | null;
  readonly error_json: unknown;
  readonly metrics_json: unknown;
  readonly findings_count: string | number;
  readonly open_findings_count: string | number;
  readonly created_at: Date | string | null;
  readonly updated_at: Date | string | null;
}

interface RepositoryCodebaseFindingRow {
  readonly id: string;
  readonly scan_run_id: string;
  readonly repository_id: string;
  readonly repository_full_name: string;
  readonly scan_status: CodebaseScanStatus;
  readonly source: CodebaseScanFindingInboxItem["source"];
  readonly category: CodebaseScanFindingInboxItem["category"];
  readonly severity: CodebaseScanFindingInboxItem["severity"];
  readonly confidence: CodebaseScanFindingInboxItem["confidence"];
  readonly file_path: string | null;
  readonly start_line: number | null;
  readonly end_line: number | null;
  readonly title: string;
  readonly body: string;
  readonly evidence_json: unknown;
  readonly recommendation: string | null;
  readonly dedupe_key: string;
  readonly status: CodebaseScanFindingInboxItem["status"];
  readonly first_seen_at: Date | string | null;
  readonly last_seen_at: Date | string | null;
  readonly resolved_at: Date | string | null;
  readonly scan_created_at: Date | string | null;
  readonly created_at: Date | string | null;
  readonly updated_at: Date | string | null;
}

export class EmptyRepositoriesStore implements RepositoriesStore {
  async listRepositories(filters: RepositoryListLookup): Promise<RepositoryListResponse> {
    return { repositories: [], filters };
  }

  async getRepositoryDetail(_input: RepositoryDetailLookup): Promise<RepositoryDetailResponse | null> {
    return null;
  }

  async listRepositoryActivity(_input: RepositoryActivityLookup): Promise<RepositoryActivityResponse | null> {
    return null;
  }

  async getRepositoryConfiguration(_input: RepositoryConfigurationLookup): Promise<RepositoryReviewConfiguration | null> {
    return null;
  }

  async updateRepositoryConfiguration(_input: RepositoryConfigurationUpdate): Promise<RepositoryReviewConfiguration | null> {
    return null;
  }
}

export class PostgresRepositoriesStore implements RepositoriesStore {
  constructor(private readonly database: DatabaseExecutor) { }

  async listRepositories(filters: RepositoryListLookup): Promise<RepositoryListResponse> {
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
JOIN github_installations gi ON gi.id = r.installation_id
${whereSql}
ORDER BY r.full_name ASC
LIMIT 100
`,
      values
    );
    const repositoryIds = result.rows.map((row) => row.id);
    const activityScope = filters.accessScope ?? FULL_REPOSITORY_ACCESS_SCOPE;
    const reviewRunValues: unknown[] = [repositoryIds];
    const reviewRunConditions = ["rr.repository_id = ANY($1)"];
    appendOwnPullRequestActivityCondition(reviewRunConditions, reviewRunValues, activityScope);
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
FROM pull_requests pr
JOIN review_runs rr ON rr.pull_request_id = pr.id
WHERE ${reviewRunConditions.join(" AND ")}
ORDER BY rr.created_at DESC
`,
      reviewRunValues
    );
    const changedFileValues: unknown[] = [repositoryIds];
    const changedFileConditions = ["rr.repository_id = ANY($1)", "cf.language IS NOT NULL"];
    appendOwnPullRequestActivityCondition(changedFileConditions, changedFileValues, activityScope);
    const changedFiles = await this.database.query<RepositoryChangedFileRow>(
      `
SELECT
  rr.repository_id,
  cf.language
FROM changed_files cf
JOIN review_runs rr ON rr.id = cf.review_run_id
JOIN pull_requests pr ON pr.id = rr.pull_request_id
WHERE ${changedFileConditions.join(" AND ")}
ORDER BY cf.created_at DESC
`,
      changedFileValues
    );
    const findingValues: unknown[] = [repositoryIds];
    const findingConditions = ["rr.repository_id = ANY($1)"];
    appendOwnPullRequestActivityCondition(findingConditions, findingValues, activityScope);
    const findings = await this.database.query<RepositoryFindingRow>(
      `
SELECT
  rr.repository_id,
  f.id AS finding_id
FROM findings f
JOIN review_runs rr ON rr.id = f.review_run_id
JOIN pull_requests pr ON pr.id = rr.pull_request_id
WHERE ${findingConditions.join(" AND ")}
`,
      findingValues
    );
    const scanAggregates = await this.loadCodebaseScanAggregates(repositoryIds);
    const aggregates = buildRepositoryAggregates(reviewRuns.rows, changedFiles.rows, findings.rows, scanAggregates);
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

  async getRepositoryDetail(input: RepositoryDetailLookup): Promise<RepositoryDetailResponse | null> {
    const repository = await this.getOwnedRepository(input);

    if (repository === null) {
      return null;
    }

    const [configuration, pullRequests, reviewRuns, findings, codebaseScans, codebaseFindings, activity] = await Promise.all([
      this.getRepositoryConfiguration(input),
      this.listRepositoryPullRequests(input.repositoryId, input.accessScope ?? FULL_REPOSITORY_ACCESS_SCOPE),
      this.listRepositoryReviewRuns(input.repositoryId, input.accessScope ?? FULL_REPOSITORY_ACCESS_SCOPE),
      this.listRepositoryFindings(input.repositoryId, input.accessScope ?? FULL_REPOSITORY_ACCESS_SCOPE),
      this.listRepositoryCodebaseScans(input.repositoryId),
      this.listRepositoryCodebaseFindings(input.repositoryId),
      this.listRepositoryActivityItems(input.repositoryId)
    ]);

    if (configuration === null) {
      return null;
    }

    return {
      repository,
      configuration,
      pullRequests,
      reviewRuns,
      findings,
      codebaseScans,
      codebaseFindings,
      activity,
      permissions: input.permissions
    };
  }

  async listRepositoryActivity(input: RepositoryActivityLookup): Promise<RepositoryActivityResponse | null> {
    const owned = await this.repositoryBelongsToWorkspace(input);

    if (!owned) {
      return null;
    }

    return {
      repositoryId: input.repositoryId,
      activity: await this.listRepositoryActivityItems(input.repositoryId)
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

  private async getOwnedRepository(input: RepositoryConfigurationLookup): Promise<RepositoryListItem | null> {
    const accessClause = buildRepositoryAccessClause(input.accessScope ?? FULL_REPOSITORY_ACCESS_SCOPE, "r", 3);
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
JOIN github_installations gi ON gi.id = r.installation_id
WHERE r.id = $1
  AND gi.workspace_id = $2
${accessClause.sql === "" ? "" : `  AND ${accessClause.sql}\n`}`,
      [input.repositoryId, input.workspaceId, ...accessClause.values]
    );
    const row = result.rows[0];

    if (row === undefined) {
      return null;
    }

    const [reviewRuns, changedFiles, findings] = await Promise.all([
      this.database.query<RepositoryReviewRunRow>(
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
WHERE rr.repository_id = $1
ORDER BY rr.created_at DESC
`,
        [input.repositoryId]
      ),
      this.database.query<RepositoryChangedFileRow>(
        `
SELECT
  rr.repository_id,
  cf.language
FROM changed_files cf
JOIN review_runs rr ON rr.id = cf.review_run_id
WHERE rr.repository_id = $1
  AND cf.language IS NOT NULL
ORDER BY cf.created_at DESC
`,
        [input.repositoryId]
      ),
      this.database.query<RepositoryFindingRow>(
        `
SELECT
  rr.repository_id,
  f.id AS finding_id
FROM findings f
JOIN review_runs rr ON rr.id = f.review_run_id
WHERE rr.repository_id = $1
`,
        [input.repositoryId]
      )
    ]);
    const scanAggregates = await this.loadCodebaseScanAggregates([input.repositoryId]);
    const aggregates = buildRepositoryAggregates(reviewRuns.rows, changedFiles.rows, findings.rows, scanAggregates);

    return toRepositoryListItem(row, aggregates.get(row.id));
  }

  private async listRepositoryPullRequests(
    repositoryId: string,
    accessScope: RepositoryAccessScope
  ): Promise<RepositoryPullRequestSummary[]> {
    const pullRequestValues: unknown[] = [repositoryId];
    const pullRequestConditions = ["repository_id = $1"];
    appendOwnPullRequestActivityCondition(pullRequestConditions, pullRequestValues, accessScope, "pull_requests");
    const reviewRunValues: unknown[] = [repositoryId];
    const reviewRunConditions = ["rr.repository_id = $1"];
    appendOwnPullRequestActivityCondition(reviewRunConditions, reviewRunValues, accessScope);

    const [pullRequests, reviewRuns] = await Promise.all([
      this.database.query<RepositoryPullRequestRow>(
        `
SELECT
  id,
  number,
  title,
  author_login,
  base_ref,
  head_ref,
  state,
  draft,
  updated_at
FROM pull_requests
WHERE ${pullRequestConditions.join(" AND ")}
ORDER BY updated_at DESC, number DESC
LIMIT 50
`,
        pullRequestValues
      ),
      this.database.query<RepositoryReviewRunRow & { pull_request_id: string }>(
        `
SELECT
  rr.repository_id,
  rr.pull_request_id,
  rr.id AS review_run_id,
  rr.status,
  rr.head_sha,
  rr.created_at,
  rr.finished_at,
  pr.number AS pull_request_number,
  pr.title AS pull_request_title
FROM review_runs rr
JOIN pull_requests pr ON pr.id = rr.pull_request_id
WHERE ${reviewRunConditions.join(" AND ")}
ORDER BY rr.created_at DESC
`,
        reviewRunValues
      )
    ]);
    const latestRunsByPullRequestId = new Map<string, RepositoryLastReview>();

    for (const row of reviewRuns.rows) {
      if (latestRunsByPullRequestId.has(row.pull_request_id)) {
        continue;
      }

      latestRunsByPullRequestId.set(row.pull_request_id, {
        reviewRunId: row.review_run_id,
        pullRequestNumber: row.pull_request_number,
        pullRequestTitle: row.pull_request_title,
        status: row.status,
        headSha: row.head_sha,
        createdAt: toRequiredIsoString(row.created_at),
        finishedAt: toIsoString(row.finished_at)
      });
    }

    return pullRequests.rows.map((row) => ({
      id: row.id,
      number: row.number,
      title: row.title,
      authorLogin: row.author_login,
      baseRef: row.base_ref,
      headRef: row.head_ref,
      state: row.state,
      draft: row.draft,
      latestReviewRun: latestRunsByPullRequestId.get(row.id) ?? null,
      updatedAt: toRequiredIsoString(row.updated_at)
    }));
  }

  private async listRepositoryReviewRuns(
    repositoryId: string,
    accessScope: RepositoryAccessScope
  ): Promise<ReviewRunListItem[]> {
    const values: unknown[] = [repositoryId];
    const conditions = ["rr.repository_id = $1"];
    appendOwnPullRequestActivityCondition(conditions, values, accessScope);

    const result = await this.database.query<RepositoryDetailReviewRunRow>(
      `
SELECT
  rr.id,
  rr.repository_id,
  rr.pull_request_id,
  r.full_name AS repository_full_name,
  pr.number AS pull_request_number,
  pr.title AS pull_request_title,
  pr.author_login AS pull_request_author,
  rr.trigger_event,
  rr.head_sha,
  rr.status,
  rr.started_at,
  rr.finished_at,
  rr.metrics_json,
  rr.created_at,
  rr.updated_at
FROM review_runs rr
JOIN repositories r ON r.id = rr.repository_id
JOIN pull_requests pr ON pr.id = rr.pull_request_id
WHERE ${conditions.join(" AND ")}
ORDER BY rr.created_at DESC
LIMIT 25
`,
      values
    );
    const counts = await this.loadReviewRunCounts(repositoryId);

    return result.rows.map((row) => toRepositoryReviewRunListItem(row, counts));
  }

  private async listRepositoryFindings(
    repositoryId: string,
    accessScope: RepositoryAccessScope
  ): Promise<FindingInboxItem[]> {
    const values: unknown[] = [repositoryId];
    const conditions = ["rr.repository_id = $1"];
    appendOwnPullRequestActivityCondition(conditions, values, accessScope);

    const result = await this.database.query<RepositoryFindingInboxRow>(
      `
SELECT
  f.id,
  f.review_run_id,
  rr.repository_id,
  r.full_name AS repository_full_name,
  pr.number AS pull_request_number,
  pr.title AS pull_request_title,
  f.source,
  f.category,
  f.severity,
  f.confidence,
  f.file_path,
  f.start_line,
  f.end_line,
  f.title,
  f.body,
  f.evidence_json,
  f.suggestion,
  f.dedupe_key,
  f.post_as_inline,
  f.created_at AS finding_created_at,
  rr.created_at AS review_run_created_at,
  pc.created_at AS posted_at,
  pc.github_comment_id
FROM findings f
JOIN review_runs rr ON rr.id = f.review_run_id
JOIN repositories r ON r.id = rr.repository_id
JOIN pull_requests pr ON pr.id = rr.pull_request_id
LEFT JOIN published_comments pc ON pc.finding_id = f.id AND pc.comment_type = 'inline'
WHERE ${conditions.join(" AND ")}
ORDER BY
  CASE f.severity
    WHEN 'critical' THEN 0
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
    ELSE 4
  END,
  f.created_at DESC,
  f.file_path ASC
LIMIT 50
`,
      values
    );

    return result.rows.map(toRepositoryFindingInboxItem);
  }

  private async listRepositoryCodebaseScans(repositoryId: string): Promise<CodebaseScanRunListItem[]> {
    const result = await this.database.query<RepositoryCodebaseScanRunRow>(
      `
SELECT
  csr.id,
  csr.repository_id,
  r.full_name AS repository_full_name,
  csr.trigger,
  csr.default_branch,
  csr.commit_sha,
  csr.status,
  csr.started_at,
  csr.finished_at,
  csr.error_json,
  csr.metrics_json,
  COUNT(csf.id) AS findings_count,
  SUM(CASE WHEN csf.status = 'open' THEN 1 ELSE 0 END) AS open_findings_count,
  csr.created_at,
  csr.updated_at
FROM codebase_scan_runs csr
JOIN repositories r ON r.id = csr.repository_id
LEFT JOIN codebase_scan_findings csf ON csf.scan_run_id = csr.id
WHERE csr.repository_id = $1
GROUP BY csr.id, r.full_name
ORDER BY csr.created_at DESC
LIMIT 10
`,
      [repositoryId]
    );

    return result.rows.map(toRepositoryCodebaseScanRunListItem);
  }

  private async listRepositoryCodebaseFindings(repositoryId: string): Promise<CodebaseScanFindingInboxItem[]> {
    const result = await this.database.query<RepositoryCodebaseFindingRow>(
      `
SELECT
  csf.id,
  csf.scan_run_id,
  csf.repository_id,
  r.full_name AS repository_full_name,
  csr.status AS scan_status,
  csf.source,
  csf.category,
  csf.severity,
  csf.confidence,
  csf.file_path,
  csf.start_line,
  csf.end_line,
  csf.title,
  csf.body,
  csf.evidence_json,
  csf.recommendation,
  csf.dedupe_key,
  csf.status,
  csf.first_seen_at,
  csf.last_seen_at,
  csf.resolved_at,
  csr.created_at AS scan_created_at,
  csf.created_at,
  csf.updated_at
FROM codebase_scan_findings csf
JOIN codebase_scan_runs csr ON csr.id = csf.scan_run_id
JOIN repositories r ON r.id = csf.repository_id
WHERE csf.repository_id = $1
  AND csf.status = 'open'
ORDER BY
  CASE csf.severity
    WHEN 'critical' THEN 0
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
    ELSE 4
  END,
  csf.last_seen_at DESC,
  csf.file_path ASC
LIMIT 50
`,
      [repositoryId]
    );

    return result.rows.map(toRepositoryCodebaseFindingInboxItem);
  }

  private async listRepositoryActivityItems(repositoryId: string): Promise<RepositoryActivityItem[]> {
    const result = await this.database.query<RepositoryActivityRow>(
      `
SELECT
  'repo:' || r.id::text AS id,
  'repository_synced' AS kind,
  'Repository metadata synced' AS title,
  r.full_name || ' metadata was refreshed from GitHub.' AS detail,
  r.updated_at AS created_at
FROM repositories r
WHERE r.id = $1
UNION ALL
SELECT
  'config:' || rc.repository_id::text AS id,
  'configuration_updated' AS kind,
  'Review configuration updated' AS title,
  CASE
    WHEN rc.updated_by_clerk_user_id IS NULL THEN 'Repository review configuration was initialized.'
    ELSE 'Repository review configuration was updated by ' || rc.updated_by_clerk_user_id || '.'
  END AS detail,
  rc.updated_at AS created_at
FROM repository_review_configurations rc
WHERE rc.repository_id = $1
UNION ALL
SELECT
  'pr:' || pr.id::text AS id,
  'pull_request_seen' AS kind,
  'Pull request #' || pr.number::text || ' tracked' AS title,
  pr.title AS detail,
  pr.updated_at AS created_at
FROM pull_requests pr
WHERE pr.repository_id = $1
UNION ALL
SELECT
  'run:' || rr.id::text AS id,
  'review_run_updated' AS kind,
  'Review run ' || rr.status AS title,
  'PR #' || pr.number::text || ' at ' || rr.head_sha AS detail,
  rr.updated_at AS created_at
FROM review_runs rr
JOIN pull_requests pr ON pr.id = rr.pull_request_id
WHERE rr.repository_id = $1
UNION ALL
SELECT
  'finding:' || f.id::text AS id,
  'finding_created' AS kind,
  'Finding created: ' || f.title AS title,
  COALESCE(f.file_path, 'Repository summary finding') AS detail,
  f.created_at AS created_at
FROM findings f
JOIN review_runs rr ON rr.id = f.review_run_id
WHERE rr.repository_id = $1
UNION ALL
SELECT
  'codebase-scan:' || csr.id::text AS id,
  'codebase_scan_updated' AS kind,
  'Codebase scan ' || csr.status AS title,
  csr.trigger || ' scan for ' || COALESCE(csr.commit_sha, csr.default_branch) AS detail,
  csr.updated_at AS created_at
FROM codebase_scan_runs csr
WHERE csr.repository_id = $1
UNION ALL
SELECT
  'codebase-finding:' || csf.id::text AS id,
  'codebase_finding_updated' AS kind,
  'Codebase finding ' || csf.status || ': ' || csf.title AS title,
  COALESCE(csf.file_path, 'Repository summary finding') AS detail,
  csf.updated_at AS created_at
FROM codebase_scan_findings csf
WHERE csf.repository_id = $1
ORDER BY created_at DESC
LIMIT 50
`,
      [repositoryId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      detail: row.detail,
      createdAt: toRequiredIsoString(row.created_at)
    }));
  }

  private async loadReviewRunCounts(repositoryId: string): Promise<Map<string, ReviewRunCounts>> {
    const [findings, comments, files] = await Promise.all([
      this.database.query<ReviewRunCountRow>(
        `
SELECT
  rr.id AS review_run_id,
  COUNT(f.id) AS count
FROM review_runs rr
LEFT JOIN findings f ON f.review_run_id = rr.id
WHERE rr.repository_id = $1
GROUP BY rr.id
`,
        [repositoryId]
      ),
      this.database.query<ReviewRunCountRow>(
        `
SELECT
  rr.id AS review_run_id,
  COUNT(pc.id) AS count
FROM review_runs rr
LEFT JOIN published_comments pc ON pc.review_run_id = rr.id
WHERE rr.repository_id = $1
GROUP BY rr.id
`,
        [repositoryId]
      ),
      this.database.query<ReviewRunCountRow>(
        `
SELECT
  rr.id AS review_run_id,
  COUNT(cf.id) AS count
FROM review_runs rr
LEFT JOIN changed_files cf ON cf.review_run_id = rr.id AND cf.is_supported = true
WHERE rr.repository_id = $1
GROUP BY rr.id
`,
        [repositoryId]
      )
    ]);
    const counts = new Map<string, ReviewRunCounts>();
    const ensure = (reviewRunId: string): ReviewRunCounts => {
      const existing = counts.get(reviewRunId);

      if (existing !== undefined) {
        return existing;
      }

      const created = {
        findingsCount: 0,
        commentsPostedCount: 0,
        filesAnalyzedCount: 0
      };
      counts.set(reviewRunId, created);

      return created;
    };

    for (const row of findings.rows) {
      ensure(row.review_run_id).findingsCount = Number(row.count);
    }

    for (const row of comments.rows) {
      ensure(row.review_run_id).commentsPostedCount = Number(row.count);
    }

    for (const row of files.rows) {
      ensure(row.review_run_id).filesAnalyzedCount = Number(row.count);
    }

    return counts;
  }

  private async loadCodebaseScanAggregates(
    repositoryIds: readonly string[]
  ): Promise<Map<string, RepositoryCodebaseScanSummary>> {
    if (repositoryIds.length === 0) {
      return new Map();
    }

    const latest = await this.database.query<RepositoryCodebaseScanAggregateRow>(
      `
SELECT
  csr.repository_id,
  csr.id AS latest_scan_run_id,
  csr.status AS latest_scan_status,
  csr.trigger AS latest_scan_trigger,
  csr.commit_sha AS latest_scan_commit_sha,
  csr.started_at AS latest_scan_started_at,
  csr.finished_at AS latest_scan_finished_at,
  csr.created_at AS latest_scan_created_at,
  0 AS open_codebase_findings_count
FROM codebase_scan_runs csr
WHERE csr.repository_id = ANY($1)
ORDER BY csr.repository_id ASC, csr.created_at DESC
`,
      [repositoryIds]
    );
    const openCounts = await this.database.query<{ repository_id: string; open_codebase_findings_count: string | number }>(
      `
SELECT repository_id, COUNT(id) AS open_codebase_findings_count
FROM codebase_scan_findings
WHERE repository_id = ANY($1)
  AND status = 'open'
GROUP BY repository_id
`,
      [repositoryIds]
    );
    const aggregates = new Map<string, RepositoryCodebaseScanSummary>();

    for (const repositoryId of repositoryIds) {
      aggregates.set(repositoryId, emptyCodebaseScanSummary());
    }

    for (const row of latest.rows) {
      const current = aggregates.get(row.repository_id);

      if (current?.latestScanRunId !== null && current?.latestScanRunId !== undefined) {
        continue;
      }

      aggregates.set(row.repository_id, {
        latestScanRunId: row.latest_scan_run_id,
        latestScanStatus: row.latest_scan_status,
        latestScanTrigger: row.latest_scan_trigger,
        latestScanCommitSha: row.latest_scan_commit_sha,
        latestScanStartedAt: toIsoString(row.latest_scan_started_at),
        latestScanFinishedAt: toIsoString(row.latest_scan_finished_at),
        latestScanCreatedAt: toIsoString(row.latest_scan_created_at),
        openCodebaseFindingsCount: aggregates.get(row.repository_id)?.openCodebaseFindingsCount ?? 0
      });
    }

    for (const row of openCounts.rows) {
      const current = aggregates.get(row.repository_id) ?? emptyCodebaseScanSummary();
      aggregates.set(row.repository_id, {
        ...current,
        openCodebaseFindingsCount: Number(row.open_codebase_findings_count)
      });
    }

    return aggregates;
  }

  async updateRepositoryConfiguration(input: RepositoryConfigurationUpdate): Promise<RepositoryReviewConfiguration | null> {
    const owned = await this.repositoryBelongsToWorkspace(input);

    if (!owned) {
      return null;
    }

    await this.ensureRepositoryConfiguration(input.repositoryId);

    const assignments = buildConfigurationAssignments(input.updates);
    const values: unknown[] = [input.repositoryId, input.updatedByUserId, ...assignments.values];
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
    const accessClause = buildRepositoryAccessClause(input.accessScope ?? FULL_REPOSITORY_ACCESS_SCOPE, "r", 3);
    const result = await this.database.query<{ id: string }>(
      `
SELECT r.id
FROM repositories r
JOIN github_installations gi ON gi.id = r.installation_id
WHERE r.id = $1
  AND gi.workspace_id = $2
${accessClause.sql === "" ? "" : `  AND ${accessClause.sql}\n`}
`,
      [input.repositoryId, input.workspaceId, ...accessClause.values]
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

function buildRepositoryWhereClause(filters: RepositoryListLookup): { whereSql: string; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.workspaceId !== undefined) {
    values.push(filters.workspaceId);
    conditions.push(`gi.workspace_id = $${values.length}`);
  }

  if (filters.enabled !== undefined) {
    values.push(filters.enabled);
    conditions.push(`r.enabled = $${values.length}`);
  }

  if (filters.private !== undefined) {
    values.push(filters.private);
    conditions.push(`r.private = $${values.length}`);
  }

  const accessClause = buildRepositoryAccessClause(
    filters.accessScope ?? FULL_REPOSITORY_ACCESS_SCOPE,
    "r",
    values.length + 1
  );
  if (accessClause.sql !== "") {
    values.push(...accessClause.values);
    conditions.push(accessClause.sql);
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
  codebaseScan: RepositoryCodebaseScanSummary;
}

interface ReviewRunCounts {
  findingsCount: number;
  commentsPostedCount: number;
  filesAnalyzedCount: number;
}

function buildRepositoryAggregates(
  reviewRuns: RepositoryReviewRunRow[],
  changedFiles: RepositoryChangedFileRow[],
  findings: RepositoryFindingRow[],
  scanAggregates: ReadonlyMap<string, RepositoryCodebaseScanSummary>
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

  for (const [repositoryId, scanAggregate] of scanAggregates) {
    ensureAggregate(aggregates, repositoryId).codebaseScan = scanAggregate;
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
    lastReview: null,
    codebaseScan: emptyCodebaseScanSummary()
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
    openCodebaseFindingsCount: aggregate?.codebaseScan?.openCodebaseFindingsCount ?? 0,
    lastReview: aggregate?.lastReview ?? null,
    codebaseScan: aggregate?.codebaseScan ?? emptyCodebaseScanSummary(),
    updatedAt: toRequiredIsoString(row.updated_at)
  };
}

function emptyCodebaseScanSummary(): RepositoryCodebaseScanSummary {
  return {
    latestScanRunId: null,
    latestScanStatus: null,
    latestScanTrigger: null,
    latestScanCommitSha: null,
    latestScanStartedAt: null,
    latestScanFinishedAt: null,
    latestScanCreatedAt: null,
    openCodebaseFindingsCount: 0
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

  if (updates.codebaseScanEnabled !== undefined) {
    append("codebase_scan_enabled", updates.codebaseScanEnabled);
  }

  if (updates.codebaseScanCadenceHours !== undefined) {
    append("codebase_scan_cadence_hours", updates.codebaseScanCadenceHours);
  }

  if (updates.codebaseScanIgnoredPaths !== undefined) {
    appendJson("codebase_scan_ignored_paths_json", updates.codebaseScanIgnoredPaths);
  }

  if (updates.codebaseScanSeverityThreshold !== undefined) {
    append("codebase_scan_severity_threshold", updates.codebaseScanSeverityThreshold);
  }

  if (updates.codebaseScanMaxFiles !== undefined) {
    append("codebase_scan_max_files", updates.codebaseScanMaxFiles);
  }

  if (updates.codebaseScanMaxBytes !== undefined) {
    append("codebase_scan_max_bytes", updates.codebaseScanMaxBytes);
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

  function appendJson(column: string, value: unknown) {
    values.push(JSON.stringify(value));
    assignments.push(`${column} = $${values.length + 2}::jsonb`);
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
    codebaseScanEnabled: row.codebase_scan_enabled,
    codebaseScanCadenceHours: Number(row.codebase_scan_cadence_hours),
    codebaseScanIgnoredPaths: normalizeStringArray(row.codebase_scan_ignored_paths_json),
    codebaseScanSeverityThreshold: row.codebase_scan_severity_threshold,
    codebaseScanMaxFiles: Number(row.codebase_scan_max_files),
    codebaseScanMaxBytes: Number(row.codebase_scan_max_bytes),
    draftPullRequestReviewsEnabled: row.draft_pr_reviews_enabled,
    maxInlineComments: Number(row.max_inline_comments),
    severityThreshold: row.severity_threshold,
    semgrepEnabled: row.semgrep_enabled,
    treeSitterEnabled: row.tree_sitter_enabled,
    ciExplanationEnabled: row.ci_explanation_enabled,
    infrastructureReviewEnabled: row.infrastructure_review_enabled,
    dryRunEnabled: row.dry_run_enabled,
    updatedByUserId: row.updated_by_clerk_user_id,
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at)
  };
}

function toRepositoryReviewRunListItem(
  row: RepositoryDetailReviewRunRow,
  counts: ReadonlyMap<string, ReviewRunCounts>
): ReviewRunListItem {
  const metrics = normalizeJsonObject(row.metrics_json);
  const rowCounts = counts.get(row.id) ?? {
    findingsCount: 0,
    commentsPostedCount: 0,
    filesAnalyzedCount: 0
  };

  return {
    id: row.id,
    repositoryId: row.repository_id,
    pullRequestId: row.pull_request_id,
    repositoryFullName: row.repository_full_name,
    pullRequestNumber: row.pull_request_number,
    pullRequestTitle: row.pull_request_title,
    pullRequestAuthor: row.pull_request_author,
    triggerEvent: row.trigger_event,
    headSha: row.head_sha,
    status: row.status,
    findingsCount: rowCounts.findingsCount,
    commentsPostedCount: rowCounts.commentsPostedCount,
    filesAnalyzedCount: rowCounts.filesAnalyzedCount,
    currentStage: deriveCurrentStage(metrics, row.status),
    durationMs: deriveDurationMs(row.started_at, row.finished_at, metrics),
    riskLevel: deriveRiskLevel(metrics),
    startedAt: toIsoString(row.started_at),
    finishedAt: toIsoString(row.finished_at),
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at)
  };
}

function toRepositoryFindingInboxItem(row: RepositoryFindingInboxRow): FindingInboxItem {
  const postedInline = row.posted_at !== null;
  const evidence = Array.isArray(row.evidence_json) ? row.evidence_json : [];

  return {
    findingType: "pull_request",
    id: row.id,
    reviewRunId: row.review_run_id,
    scanRunId: null,
    repositoryId: row.repository_id,
    repositoryFullName: row.repository_full_name,
    pullRequestNumber: row.pull_request_number,
    pullRequestTitle: row.pull_request_title,
    scanStatus: null,
    source: row.source,
    category: row.category,
    severity: row.severity,
    confidence: row.confidence,
    filePath: row.file_path,
    startLine: row.start_line,
    endLine: row.end_line,
    title: row.title,
    body: row.body,
    evidence,
    suggestion: row.suggestion,
    dedupeKey: row.dedupe_key,
    postAsInline: row.post_as_inline,
    postedInline,
    status: deriveFindingStatus(postedInline),
    semgrepRuleId: findSemgrepRuleId(evidence),
    githubCommentId: toNullableNumber(row.github_comment_id),
    githubCommentUrl: buildGitHubCommentUrl(row.repository_full_name, row.pull_request_number, row.github_comment_id),
    postedAt: toIsoString(row.posted_at),
    createdAt: toRequiredIsoString(row.finding_created_at),
    reviewRunCreatedAt: toRequiredIsoString(row.review_run_created_at),
    scanRunCreatedAt: null,
    statusUpdatedAt: null
  };
}

function toRepositoryCodebaseScanRunListItem(row: RepositoryCodebaseScanRunRow): CodebaseScanRunListItem {
  const error = normalizeJsonObject(row.error_json);
  return {
    id: row.id,
    repositoryId: row.repository_id,
    repositoryFullName: row.repository_full_name,
    trigger: row.trigger,
    defaultBranch: row.default_branch,
    commitSha: row.commit_sha,
    status: row.status,
    startedAt: toIsoString(row.started_at),
    finishedAt: toIsoString(row.finished_at),
    durationMs: deriveDurationMs(row.started_at, row.finished_at, normalizeJsonObject(row.metrics_json)),
    findingsCount: Number(row.findings_count),
    openFindingsCount: Number(row.open_findings_count),
    errorCode: typeof error.code === "string" ? error.code : null,
    errorMessage: typeof error.message === "string" ? error.message : null,
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at)
  };
}

function toRepositoryCodebaseFindingInboxItem(row: RepositoryCodebaseFindingRow): CodebaseScanFindingInboxItem {
  const evidence = Array.isArray(row.evidence_json) ? row.evidence_json : [];
  return {
    findingType: "codebase_scan",
    id: row.id,
    reviewRunId: null,
    scanRunId: row.scan_run_id,
    repositoryId: row.repository_id,
    repositoryFullName: row.repository_full_name,
    pullRequestNumber: null,
    pullRequestTitle: null,
    scanStatus: row.scan_status,
    source: row.source,
    category: row.category,
    severity: row.severity,
    confidence: row.confidence,
    filePath: row.file_path,
    startLine: row.start_line,
    endLine: row.end_line,
    title: row.title,
    body: row.body,
    evidence,
    suggestion: row.recommendation,
    dedupeKey: row.dedupe_key,
    postAsInline: false,
    postedInline: false,
    status: row.status,
    semgrepRuleId: findSemgrepRuleId(evidence),
    githubCommentId: null,
    githubCommentUrl: null,
    postedAt: null,
    createdAt: toRequiredIsoString(row.created_at),
    reviewRunCreatedAt: null,
    scanRunCreatedAt: toRequiredIsoString(row.scan_created_at),
    statusUpdatedAt: toRequiredIsoString(row.updated_at)
  };
}

function deriveFindingStatus(postedInline: boolean): ReviewFindingStatus {
  return postedInline ? "posted" : "open";
}

function findSemgrepRuleId(evidence: unknown[]): string | null {
  for (const entry of evidence) {
    const ruleId = readRuleId(entry);

    if (ruleId !== null) {
      return ruleId;
    }
  }

  return null;
}

function readRuleId(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  for (const key of ["ruleId", "rule_id", "semgrepRuleId", "check_id"]) {
    const candidate = value[key];

    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  for (const nested of ["metadata", "semgrep", "finding"]) {
    const candidate = readRuleId(value[nested]);

    if (candidate !== null) {
      return candidate;
    }
  }

  return null;
}

function buildGitHubCommentUrl(
  repositoryFullName: string,
  pullRequestNumber: number,
  githubCommentId: string | number | null
): string | null {
  if (githubCommentId === null) {
    return null;
  }

  return `https://github.com/${repositoryFullName}/pull/${pullRequestNumber}#discussion_r${githubCommentId}`;
}

function toNullableNumber(value: string | number | null): number | null {
  return value === null ? null : Number(value);
}

function deriveCurrentStage(metrics: Record<string, unknown>, status: ReviewRunStatus): string {
  if (typeof metrics.currentStage === "string" && metrics.currentStage.length > 0) {
    return metrics.currentStage;
  }

  if (status === "queued") {
    return "Webhook Received";
  }

  if (status === "running") {
    return "Review pipeline";
  }

  return status === "succeeded" ? "Comments Published" : "Review stopped";
}

function deriveDurationMs(
  startedAt: Date | string | null,
  finishedAt: Date | string | null,
  metrics: Record<string, unknown>
): number | null {
  const metricDuration = readNullableNumberMetric(metrics, "durationMs");

  if (metricDuration !== null) {
    return metricDuration;
  }

  if (startedAt === null || finishedAt === null) {
    return null;
  }

  return new Date(finishedAt).getTime() - new Date(startedAt).getTime();
}

function deriveRiskLevel(metrics: Record<string, unknown>): ReviewRunRiskLevel {
  return metrics.riskLevel === "low" || metrics.riskLevel === "medium" || metrics.riskLevel === "high"
    ? metrics.riskLevel
    : "unknown";
}

function readNullableNumberMetric(metrics: Record<string, unknown>, key: string): number | null {
  const value = metrics[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
