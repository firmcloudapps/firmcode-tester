import type {
  CodebaseScanFindingInboxItem,
  CodebaseScanStatus,
  FindingInboxItem,
  FindingsListFilters,
  FindingsListResponse,
  ReviewFindingCategory,
  ReviewFindingConfidence,
  ReviewFindingSeverity,
  ReviewFindingSource,
  ReviewFindingStatus
} from "@firmcode/shared";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const FINDINGS_STORE = Symbol("FINDINGS_STORE");

export interface ListFindingsInput {
  readonly workspaceId: string;
  readonly filters: FindingsListFilters;
  readonly canManageCodebaseFindings: boolean;
}

export interface FindingsStore {
  listFindings(input: ListFindingsInput): Promise<FindingsListResponse>;
}

interface FindingInboxRow {
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

interface CodebaseFindingInboxRow {
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
  readonly scan_created_at: Date | string | null;
  readonly created_at: Date | string | null;
  readonly updated_at: Date | string | null;
}

export class EmptyFindingsStore implements FindingsStore {
  async listFindings(input: ListFindingsInput): Promise<FindingsListResponse> {
    return {
      findings: [],
      filters: input.filters,
      permissions: { canManageCodebaseFindings: input.canManageCodebaseFindings }
    };
  }
}

export class PostgresFindingsStore implements FindingsStore {
  constructor(private readonly database: DatabaseExecutor) {}

  async listFindings(input: ListFindingsInput): Promise<FindingsListResponse> {
    const pullRequestFindings = input.filters.findingType === "codebase_scan" ? [] : await this.listPullRequestFindings(input);
    const codebaseFindings = input.filters.findingType === "pull_request" ? [] : await this.listCodebaseFindings(input);
    const findings = [...pullRequestFindings, ...codebaseFindings].sort(compareFindings).slice(0, 200);

    return {
      findings,
      filters: input.filters,
      permissions: { canManageCodebaseFindings: input.canManageCodebaseFindings }
    };
  }

  private async listPullRequestFindings(input: ListFindingsInput): Promise<FindingInboxItem[]> {
    const { whereSql, values } = buildPullRequestFindingsWhereClause(input.workspaceId, input.filters);
    const result = await this.database.query<FindingInboxRow>(
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
JOIN github_installations gi ON gi.id = r.installation_id
JOIN pull_requests pr ON pr.id = rr.pull_request_id
LEFT JOIN published_comments pc ON pc.finding_id = f.id AND pc.comment_type = 'inline'
${whereSql}
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
LIMIT 200
`,
      values
    );

    return result.rows.map(toFindingInboxItem);
  }

  private async listCodebaseFindings(input: ListFindingsInput): Promise<CodebaseScanFindingInboxItem[]> {
    const { whereSql, values } = buildCodebaseFindingsWhereClause(input.workspaceId, input.filters);
    const result = await this.database.query<CodebaseFindingInboxRow>(
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
  csr.created_at AS scan_created_at,
  csf.created_at,
  csf.updated_at
FROM codebase_scan_findings csf
JOIN codebase_scan_runs csr ON csr.id = csf.scan_run_id
JOIN repositories r ON r.id = csf.repository_id
JOIN github_installations gi ON gi.id = r.installation_id
${whereSql}
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
LIMIT 200
`,
      values
    );

    return result.rows.map(toCodebaseFindingInboxItem);
  }
}

function buildPullRequestFindingsWhereClause(workspaceId: string, filters: FindingsListFilters): { whereSql: string; values: unknown[] } {
  const conditions: string[] = ["gi.workspace_id = $1"];
  const values: unknown[] = [workspaceId];

  appendSharedFindingFilters("f", "rr", "r", conditions, values, filters);

  if (filters.status !== undefined) {
    if (filters.status === "posted") {
      conditions.push("pc.finding_id IS NOT NULL");
    } else if (filters.status === "open") {
      conditions.push("pc.finding_id IS NULL");
    } else {
      conditions.push("1 = 0");
    }
  }

  if (filters.postedInline !== undefined) {
    conditions.push(filters.postedInline ? "pc.finding_id IS NOT NULL" : "pc.finding_id IS NULL");
  }

  return {
    whereSql: `WHERE ${conditions.join(" AND ")}`,
    values
  };
}

function buildCodebaseFindingsWhereClause(workspaceId: string, filters: FindingsListFilters): { whereSql: string; values: unknown[] } {
  const conditions: string[] = ["gi.workspace_id = $1"];
  const values: unknown[] = [workspaceId];

  appendSharedFindingFilters("csf", "csf", "r", conditions, values, filters);

  if (filters.status !== undefined) {
    if (filters.status === "posted") {
      conditions.push("1 = 0");
    } else {
      values.push(filters.status);
      conditions.push(`csf.status = $${values.length}`);
    }
  }

  if (filters.postedInline === true) {
    conditions.push("1 = 0");
  }

  return {
    whereSql: `WHERE ${conditions.join(" AND ")}`,
    values
  };
}

function appendSharedFindingFilters(
  findingAlias: string,
  repositoryIdAlias: string,
  repositoryAlias: string,
  conditions: string[],
  values: unknown[],
  filters: FindingsListFilters
): void {
  if (filters.severity !== undefined) {
    values.push(filters.severity);
    conditions.push(`${findingAlias}.severity = $${values.length}`);
  }

  if (filters.source !== undefined) {
    values.push(filters.source);
    conditions.push(`${findingAlias}.source = $${values.length}`);
  }

  if (filters.category !== undefined) {
    values.push(filters.category);
    conditions.push(`${findingAlias}.category = $${values.length}`);
  }

  if (filters.repositoryId !== undefined) {
    values.push(filters.repositoryId);
    conditions.push(`${repositoryIdAlias}.repository_id = $${values.length}`);
  } else if (filters.repository !== undefined) {
    values.push(filters.repository);
    conditions.push(`lower(${repositoryAlias}.full_name) = lower($${values.length})`);
  }

  if (filters.dateFrom !== undefined) {
    values.push(filters.dateFrom);
    conditions.push(`${findingAlias}.created_at >= $${values.length}`);
  }

  if (filters.dateTo !== undefined) {
    values.push(filters.dateTo);
    conditions.push(`${findingAlias}.created_at <= $${values.length}`);
  }
}

function toFindingInboxItem(row: FindingInboxRow): FindingInboxItem {
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

function toCodebaseFindingInboxItem(row: CodebaseFindingInboxRow): CodebaseScanFindingInboxItem {
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

function compareFindings(left: FindingInboxItem, right: FindingInboxItem): number {
  const severityDelta = severityRank(left.severity) - severityRank(right.severity);

  if (severityDelta !== 0) {
    return severityDelta;
  }

  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function severityRank(severity: ReviewFindingSeverity): number {
  switch (severity) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
      return 3;
    case "info":
      return 4;
  }
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

function toIsoString(value: Date | string | null): string | null {
  return value === null ? null : toRequiredIsoString(value);
}

function toRequiredIsoString(value: Date | string | null): string {
  if (value === null) {
    return new Date(0).toISOString();
  }

  return typeof value === "string" ? new Date(value).toISOString() : value.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
