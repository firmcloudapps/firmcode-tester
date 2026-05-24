import type {
  CiFailureDetailResponse,
  CiFailureFailedJob,
  CiFailureListFilters,
  CiFailureListItem,
  CiFailureListResponse,
  CiFailureRelatedReviewRun,
  CiFailureSuggestedFix,
  ReviewRunArtifact,
  ReviewRunArtifactType,
  ReviewRunLogExcerpt,
  ReviewRunStatus
} from "@firmcode/shared";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const CI_FAILURES_STORE = Symbol("CI_FAILURES_STORE");

export interface CiFailuresStore {
  listCiFailures(input: CiFailureListInput): Promise<CiFailureListResponse>;
  getCiFailureDetail(input: CiFailureDetailLookup): Promise<CiFailureDetailResponse | null>;
}

export interface CiFailureListInput {
  readonly workspaceId: string;
  readonly canAccessRawArtifacts: boolean;
  readonly filters: CiFailureListFilters;
}

export interface CiFailureDetailLookup {
  readonly workspaceId: string;
  readonly ciFailureId: string;
  readonly canAccessRawArtifacts: boolean;
}

interface CiFailureArtifactRow {
  readonly review_run_id: string;
  readonly repository_id: string;
  readonly pull_request_id: string;
  readonly repository_full_name: string;
  readonly pull_request_number: number;
  readonly pull_request_title: string;
  readonly status: ReviewRunStatus;
  readonly review_run_created_at: Date | string | null;
  readonly artifact_id: string;
  readonly artifact_type: ReviewRunArtifactType;
  readonly storage_key: string;
  readonly metadata_json: unknown;
  readonly artifact_created_at: Date | string | null;
}

interface GroupedRun {
  readonly reviewRunId: string;
  readonly repositoryId: string;
  readonly pullRequestId: string;
  readonly repositoryFullName: string;
  readonly pullRequestNumber: number;
  readonly pullRequestTitle: string;
  readonly status: ReviewRunStatus;
  readonly reviewRunCreatedAt: string;
  readonly artifacts: CiFailureArtifactRow[];
}

interface CiFailureRecord {
  readonly run: GroupedRun;
  readonly explanationArtifact: CiFailureArtifactRow;
  readonly explanation: Record<string, unknown>;
  readonly primaryGroup: Record<string, unknown>;
}

export class EmptyCiFailuresStore implements CiFailuresStore {
  async listCiFailures(input: CiFailureListInput): Promise<CiFailureListResponse> {
    return {
      ciFailures: [],
      filters: input.filters,
      pagination: {
        limit: input.filters.limit ?? DEFAULT_CI_FAILURE_LIMIT,
        returned: 0
      }
    };
  }

  async getCiFailureDetail(_input: CiFailureDetailLookup): Promise<CiFailureDetailResponse | null> {
    return null;
  }
}

export class PostgresCiFailuresStore implements CiFailuresStore {
  constructor(private readonly database: DatabaseExecutor) {}

  async listCiFailures(input: CiFailureListInput): Promise<CiFailureListResponse> {
    const limit = input.filters.limit ?? DEFAULT_CI_FAILURE_LIMIT;
    const rows = await this.loadCandidateRows(input.workspaceId, input.filters);
    const ciFailures = buildCiFailureRecords(rows)
      .map((record) => toCiFailureListItem(record))
      .filter((item) => matchesPostQueryFilters(item, input.filters))
      .slice(0, limit);

    return {
      ciFailures,
      filters: input.filters,
      pagination: {
        limit,
        returned: ciFailures.length
      }
    };
  }

  async getCiFailureDetail(input: CiFailureDetailLookup): Promise<CiFailureDetailResponse | null> {
    const rows = await this.loadCandidateRows(input.workspaceId, {});
    const record = buildCiFailureRecords(rows).find((candidate) => toCiFailureId(candidate) === input.ciFailureId);

    if (record === undefined) {
      return null;
    }

    return toCiFailureDetail(record, input.canAccessRawArtifacts);
  }

  private async loadCandidateRows(workspaceId: string, filters: CiFailureListFilters): Promise<CiFailureArtifactRow[]> {
    const { whereSql, values } = buildCiFailureWhereClause(workspaceId, filters);
    const result = await this.database.query<CiFailureArtifactRow>(
      `
SELECT
  rr.id AS review_run_id,
  rr.repository_id,
  rr.pull_request_id,
  r.full_name AS repository_full_name,
  pr.number AS pull_request_number,
  pr.title AS pull_request_title,
  rr.status,
  rr.created_at AS review_run_created_at,
  aa.id AS artifact_id,
  aa.artifact_type,
  aa.storage_key,
  aa.metadata_json,
  aa.created_at AS artifact_created_at
FROM review_runs rr
JOIN repositories r ON r.id = rr.repository_id
JOIN github_installations gi ON gi.id = r.installation_id
JOIN pull_requests pr ON pr.id = rr.pull_request_id
JOIN analysis_artifacts aa ON aa.review_run_id = rr.id
${whereSql}
ORDER BY rr.created_at DESC, aa.created_at ASC, aa.artifact_type ASC
LIMIT 1000
`,
      values
    );

    return result.rows;
  }
}

const DEFAULT_CI_FAILURE_LIMIT = 50;

function buildCiFailureWhereClause(
  workspaceId: string,
  filters: CiFailureListFilters
): { whereSql: string; values: unknown[] } {
  const conditions = ["gi.workspace_id = $1"];
  const values: unknown[] = [workspaceId];

  if (filters.repositoryId !== undefined) {
    values.push(filters.repositoryId);
    conditions.push(`rr.repository_id = $${values.length}`);
  } else if (filters.repository !== undefined) {
    values.push(filters.repository);
    conditions.push(`lower(r.full_name) = lower($${values.length})`);
  }

  if (filters.status !== undefined) {
    values.push(filters.status);
    conditions.push(`rr.status = $${values.length}`);
  }

  if (filters.dateFrom !== undefined) {
    values.push(filters.dateFrom);
    conditions.push(`rr.created_at >= $${values.length}`);
  }

  if (filters.dateTo !== undefined) {
    values.push(filters.dateTo);
    conditions.push(`rr.created_at <= $${values.length}`);
  }

  conditions.push("aa.artifact_type IN ('ci_failure_explanation', 'ci_log', 'llm_raw')");

  return {
    whereSql: `WHERE ${conditions.join(" AND ")}`,
    values
  };
}

function buildCiFailureRecords(rows: CiFailureArtifactRow[]): CiFailureRecord[] {
  const grouped = new Map<string, GroupedRun>();

  for (const row of rows) {
    const existing = grouped.get(row.review_run_id);

    if (existing !== undefined) {
      existing.artifacts.push(row);
      continue;
    }

    grouped.set(row.review_run_id, {
      reviewRunId: row.review_run_id,
      repositoryId: row.repository_id,
      pullRequestId: row.pull_request_id,
      repositoryFullName: row.repository_full_name,
      pullRequestNumber: row.pull_request_number,
      pullRequestTitle: row.pull_request_title,
      status: row.status,
      reviewRunCreatedAt: toRequiredIsoString(row.review_run_created_at),
      artifacts: [row]
    });
  }

  return [...grouped.values()]
    .map(toCiFailureRecord)
    .filter((record): record is CiFailureRecord => record !== null)
    .sort((left, right) => right.explanationArtifact.artifact_created_at!.toString().localeCompare(left.explanationArtifact.artifact_created_at!.toString()));
}

function toCiFailureRecord(run: GroupedRun): CiFailureRecord | null {
  for (const artifact of run.artifacts) {
    const artifactBody = unwrapArtifact(artifact.metadata_json);

    if (artifactBody?.schemaVersion === "ci-failure-explanation/v1") {
      const groups = readGroups(artifactBody);
      const primaryGroup = groups[0];

      if (primaryGroup === undefined) {
        return null;
      }

      return {
        run,
        explanationArtifact: artifact,
        explanation: artifactBody,
        primaryGroup
      };
    }
  }

  return null;
}

function toCiFailureListItem(record: CiFailureRecord): CiFailureListItem {
  return {
    id: toCiFailureId(record),
    repositoryId: record.run.repositoryId,
    repositoryFullName: record.run.repositoryFullName,
    pullRequestId: record.run.pullRequestId,
    pullRequestNumber: record.run.pullRequestNumber,
    pullRequestTitle: record.run.pullRequestTitle,
    reviewRunId: record.run.reviewRunId,
    failedJob: toFailedJob(record.primaryGroup, record.run.artifacts),
    rootCauseSummary: readString(record.primaryGroup.rootCauseSummary) ?? readString(record.explanation.summary) ?? "CI failed without a root cause summary.",
    flakySuspected: readGroups(record.explanation).some((group) => group.flaky === true),
    suggestedFix: readStringArray(record.primaryGroup.suggestedFixes)[0] ?? null,
    status: record.run.status,
    createdAt: toRequiredIsoString(record.explanationArtifact.artifact_created_at)
  };
}

function toCiFailureDetail(record: CiFailureRecord, canAccessRawArtifacts: boolean): CiFailureDetailResponse {
  const listItem = toCiFailureListItem(record);
  const groups = readGroups(record.explanation);
  const suggestedFixes = uniqueStrings(groups.flatMap((group) => readStringArray(group.suggestedFixes))).map<CiFailureSuggestedFix>(
    (text, index) => ({
      id: `${listItem.id}:fix:${index + 1}`,
      text
    })
  );
  const relatedReviewRun: CiFailureRelatedReviewRun = {
    id: record.run.reviewRunId,
    status: record.run.status,
    createdAt: record.run.reviewRunCreatedAt,
    detailUrl: `/api/review-runs/${record.run.reviewRunId}`
  };

  return {
    ...listItem,
    rootCause: listItem.rootCauseSummary,
    suggestedFixes,
    failedJobs: groups.map((group) => toFailedJob(group, record.run.artifacts)),
    relatedReviewRun,
    relatedArtifacts: sortRelatedArtifacts(record.run.artifacts).map((artifact) => toArtifact(artifact, canAccessRawArtifacts)),
    logExcerpts: deriveRedactedLogExcerpts(record, groups),
    unavailableLogNotes: Array.isArray(record.explanation.unavailableLogNotes) ? record.explanation.unavailableLogNotes : []
  };
}

function sortRelatedArtifacts(artifacts: readonly CiFailureArtifactRow[]): CiFailureArtifactRow[] {
  return [...artifacts].sort((left, right) => {
    const leftRank = left.artifact_type === "ci_failure_explanation" ? 0 : 1;
    const rightRank = right.artifact_type === "ci_failure_explanation" ? 0 : 1;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return toRequiredIsoString(left.artifact_created_at).localeCompare(toRequiredIsoString(right.artifact_created_at));
  });
}

function toCiFailureId(record: CiFailureRecord): string {
  const groupId = readString(record.primaryGroup.id) ?? "primary";
  return `${record.explanationArtifact.artifact_id}:${encodeURIComponent(groupId)}`;
}

function toFailedJob(group: Record<string, unknown>, artifacts: CiFailureArtifactRow[]): CiFailureFailedJob {
  const checkRunId = readNumber(group.checkRunId) ?? 0;
  const checkRun = findCheckRun(artifacts, checkRunId);

  return {
    id: readString(group.id) ?? `ci:${checkRunId}`,
    workflowName: readString(checkRun?.workflowName) ?? null,
    jobName: readString(group.jobName) ?? readString(checkRun?.name) ?? "Unknown CI job",
    checkRunId,
    conclusion: readString(group.conclusion) ?? readString(checkRun?.conclusion) ?? "failure",
    stepName: readString(group.stepName),
    category: readString(group.category) ?? "unknown",
    detailsUrl: readString(checkRun?.detailsUrl) ?? readString(checkRun?.htmlUrl) ?? null
  };
}

function findCheckRun(artifacts: CiFailureArtifactRow[], checkRunId: number): Record<string, unknown> | null {
  for (const artifact of artifacts) {
    const body = unwrapArtifact(artifact.metadata_json);
    const checkRuns = Array.isArray(body?.checkRuns) ? body.checkRuns : [];
    const checkRun = checkRuns.find((candidate): candidate is Record<string, unknown> => {
      return isRecord(candidate) && readNumber(candidate.id) === checkRunId;
    });

    if (checkRun !== undefined) {
      return checkRun;
    }
  }

  return null;
}

function toArtifact(row: CiFailureArtifactRow, canAccessRawArtifacts: boolean): ReviewRunArtifact {
  return {
    id: row.artifact_id,
    artifactType: row.artifact_type,
    storageKey: canAccessRawArtifacts ? row.storage_key : null,
    metadata: sanitizeArtifactMetadata(row.metadata_json),
    rawAccessAllowed: canAccessRawArtifacts,
    rawAccessRequiredRole: "developer",
    rawAccessUrl: canAccessRawArtifacts ? `/api/review-runs/${row.review_run_id}/artifacts/${row.artifact_id}/raw` : null,
    createdAt: toRequiredIsoString(row.artifact_created_at)
  };
}

function sanitizeArtifactMetadata(value: unknown): Record<string, unknown> {
  const metadata = isRecord(value) ? { ...value } : {};
  const artifact = unwrapArtifact(value);

  if (artifact?.schemaVersion === "ci-log-artifact/v1") {
    return {
      schemaVersion: artifact.schemaVersion,
      redacted: true,
      logsCount: Array.isArray(artifact.logs) ? artifact.logs.length : 0,
      unavailableLogsCount: Array.isArray(artifact.unavailableLogs) ? artifact.unavailableLogs.length : 0
    };
  }

  return metadata;
}

function deriveRedactedLogExcerpts(record: CiFailureRecord, groups: Record<string, unknown>[]): Array<ReviewRunLogExcerpt & { collapsed: true }> {
  const excerpts: Array<ReviewRunLogExcerpt & { collapsed: true }> = [];

  groups.forEach((group, groupIndex) => {
    const evidence = Array.isArray(group.evidence) ? group.evidence : [];

    evidence.forEach((entry, entryIndex) => {
      if (!isRecord(entry)) {
        return;
      }

      const excerpt = readString(entry.excerpt);

      if (excerpt === null) {
        return;
      }

      excerpts.push({
        id: `${toCiFailureId(record)}:excerpt:${groupIndex + 1}:${entryIndex + 1}`,
        source: "ci_log",
        title: readString(group.stepName) ?? readString(group.jobName) ?? `CI log excerpt ${entryIndex + 1}`,
        excerpt,
        artifactId: findCiLogArtifactId(record.run.artifacts, readNumber(entry.checkRunId)),
        storageKey: null,
        redacted: true,
        truncated: false,
        collapsed: true,
        createdAt: toRequiredIsoString(record.explanationArtifact.artifact_created_at)
      });
    });
  });

  return excerpts;
}

function findCiLogArtifactId(artifacts: CiFailureArtifactRow[], checkRunId: number | null): string | null {
  for (const artifact of artifacts) {
    if (artifact.artifact_type !== "ci_log") {
      continue;
    }

    if (checkRunId === null) {
      return artifact.artifact_id;
    }

    const body = unwrapArtifact(artifact.metadata_json);
    const logs = Array.isArray(body?.logs) ? body.logs : [];
    const hasMatchingLog = logs.some((log) => isRecord(log) && readNumber(log.checkRunId) === checkRunId);

    if (hasMatchingLog) {
      return artifact.artifact_id;
    }
  }

  return null;
}

function matchesPostQueryFilters(item: CiFailureListItem, filters: CiFailureListFilters): boolean {
  return filters.flaky === undefined || item.flakySuspected === filters.flaky;
}

function unwrapArtifact(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  if (isRecord(value.artifact)) {
    return value.artifact;
  }

  return value;
}

function readGroups(value: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(value.groups) ? value.groups.filter(isRecord) : [];
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRequiredIsoString(value: Date | string | null): string {
  if (value === null) {
    return new Date(0).toISOString();
  }

  return typeof value === "string" ? new Date(value).toISOString() : value.toISOString();
}
