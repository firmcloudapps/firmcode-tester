import type {
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

export interface FindingsStore {
  listFindings(filters: FindingsListFilters): Promise<FindingsListResponse>;
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

export class EmptyFindingsStore implements FindingsStore {
  async listFindings(filters: FindingsListFilters): Promise<FindingsListResponse> {
    return { findings: [], filters };
  }
}

export class PostgresFindingsStore implements FindingsStore {
  constructor(private readonly database: DatabaseExecutor) {}

  async listFindings(filters: FindingsListFilters): Promise<FindingsListResponse> {
    const { whereSql, values } = buildFindingsWhereClause(filters);
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

    return {
      findings: result.rows.map(toFindingInboxItem),
      filters
    };
  }
}

function buildFindingsWhereClause(filters: FindingsListFilters): { whereSql: string; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.severity !== undefined) {
    values.push(filters.severity);
    conditions.push(`f.severity = $${values.length}`);
  }

  if (filters.source !== undefined) {
    values.push(filters.source);
    conditions.push(`f.source = $${values.length}`);
  }

  if (filters.category !== undefined) {
    values.push(filters.category);
    conditions.push(`f.category = $${values.length}`);
  }

  if (filters.repositoryId !== undefined) {
    values.push(filters.repositoryId);
    conditions.push(`rr.repository_id = $${values.length}`);
  } else if (filters.repository !== undefined) {
    values.push(filters.repository);
    conditions.push(`lower(r.full_name) = lower($${values.length})`);
  }

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

  if (filters.dateFrom !== undefined) {
    values.push(filters.dateFrom);
    conditions.push(`f.created_at >= $${values.length}`);
  }

  if (filters.dateTo !== undefined) {
    values.push(filters.dateTo);
    conditions.push(`f.created_at <= $${values.length}`);
  }

  return {
    whereSql: conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`,
    values
  };
}

function toFindingInboxItem(row: FindingInboxRow): FindingInboxItem {
  const postedInline = row.posted_at !== null;
  const evidence = Array.isArray(row.evidence_json) ? row.evidence_json : [];

  return {
    id: row.id,
    reviewRunId: row.review_run_id,
    repositoryId: row.repository_id,
    repositoryFullName: row.repository_full_name,
    pullRequestNumber: row.pull_request_number,
    pullRequestTitle: row.pull_request_title,
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
    reviewRunCreatedAt: toRequiredIsoString(row.review_run_created_at)
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
