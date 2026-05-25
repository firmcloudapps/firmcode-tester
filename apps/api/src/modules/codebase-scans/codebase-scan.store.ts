import type {
  WorkerCodebaseScanArtifactMetadataItem,
  WorkerCodebaseScanFindingCategory,
  WorkerCodebaseScanFindingConfidence,
  WorkerCodebaseScanFindingEvidence,
  WorkerCodebaseScanFindingStatus,
  WorkerCodebaseScanStatus,
  WorkerCodebaseScanTrigger,
  WorkerFindingSource,
  WorkerSeverity
} from "@firmcode/shared";
import { randomUUID } from "crypto";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const CODEBASE_SCAN_STORE = Symbol("CODEBASE_SCAN_STORE");

export interface CodebaseScanStore {
  createScanRun(input: CreateCodebaseScanRunInput): Promise<CodebaseScanRunRecord>;
  createOrReuseActiveScanRun(input: CreateCodebaseScanRunInput): Promise<CodebaseScanRunCreationResult>;
  updateScanRun(input: UpdateCodebaseScanRunInput): Promise<CodebaseScanRunRecord | null>;
  upsertFinding(input: UpsertCodebaseScanFindingInput): Promise<CodebaseScanFindingRecord>;
  listOpenFindings(input: ListOpenCodebaseScanFindingsInput): Promise<CodebaseScanFindingRecord[]>;
  listReviewEnrichmentFindings(input: ListReviewEnrichmentCodebaseScanFindingsInput): Promise<CodebaseScanFindingRecord[]>;
  resolveStaleFindingsAfterSuccessfulScan(input: ResolveStaleCodebaseScanFindingsInput): Promise<number>;
}

export interface CreateCodebaseScanRunInput {
  readonly repositoryId: string;
  readonly trigger: WorkerCodebaseScanTrigger;
  readonly defaultBranch: string;
  readonly commitSha: string | null;
  readonly status?: WorkerCodebaseScanStatus;
  readonly metrics?: Record<string, unknown>;
  readonly artifacts?: readonly WorkerCodebaseScanArtifactMetadataItem[];
}

export interface CodebaseScanRunCreationResult {
  readonly scanRun: CodebaseScanRunRecord;
  readonly created: boolean;
}

export interface UpdateCodebaseScanRunInput {
  readonly scanRunId: string;
  readonly status?: WorkerCodebaseScanStatus;
  readonly startedAt?: string | null;
  readonly finishedAt?: string | null;
  readonly error?: Record<string, unknown>;
  readonly metrics?: Record<string, unknown>;
  readonly artifacts?: readonly WorkerCodebaseScanArtifactMetadataItem[];
}

export interface UpsertCodebaseScanFindingInput {
  readonly scanRunId: string;
  readonly repositoryId: string;
  readonly source: WorkerFindingSource;
  readonly category: WorkerCodebaseScanFindingCategory;
  readonly severity: WorkerSeverity;
  readonly confidence: WorkerCodebaseScanFindingConfidence;
  readonly filePath: string | null;
  readonly startLine: number | null;
  readonly endLine: number | null;
  readonly title: string;
  readonly body: string;
  readonly evidence: readonly WorkerCodebaseScanFindingEvidence[];
  readonly recommendation: string | null;
  readonly dedupeKey: string;
}

export interface ListOpenCodebaseScanFindingsInput {
  readonly repositoryId: string;
  readonly severities?: readonly WorkerSeverity[];
  readonly filePaths?: readonly string[];
  readonly limit?: number;
}

export interface ListReviewEnrichmentCodebaseScanFindingsInput {
  readonly repositoryId: string;
  readonly changedFilePaths: readonly string[];
  readonly componentPrefixes: readonly string[];
  readonly limit?: number;
}

export interface ResolveStaleCodebaseScanFindingsInput {
  readonly scanRunId: string;
  readonly repositoryId: string;
  readonly observedDedupeKeys: readonly string[];
}

export interface CodebaseScanRunRecord {
  readonly id: string;
  readonly repositoryId: string;
  readonly installationId: string;
  readonly trigger: WorkerCodebaseScanTrigger;
  readonly defaultBranch: string;
  readonly commitSha: string | null;
  readonly status: WorkerCodebaseScanStatus;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly error: Record<string, unknown>;
  readonly metrics: Record<string, unknown>;
  readonly artifacts: readonly WorkerCodebaseScanArtifactMetadataItem[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CodebaseScanFindingRecord {
  readonly id: string;
  readonly scanRunId: string;
  readonly repositoryId: string;
  readonly source: WorkerFindingSource;
  readonly category: WorkerCodebaseScanFindingCategory;
  readonly severity: WorkerSeverity;
  readonly confidence: WorkerCodebaseScanFindingConfidence;
  readonly filePath: string | null;
  readonly startLine: number | null;
  readonly endLine: number | null;
  readonly title: string;
  readonly body: string;
  readonly evidence: readonly WorkerCodebaseScanFindingEvidence[];
  readonly recommendation: string | null;
  readonly dedupeKey: string;
  readonly status: WorkerCodebaseScanFindingStatus;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface CodebaseScanRunRow {
  readonly id: string;
  readonly repository_id: string;
  readonly installation_id: string;
  readonly trigger: WorkerCodebaseScanTrigger;
  readonly default_branch: string;
  readonly commit_sha: string | null;
  readonly status: WorkerCodebaseScanStatus;
  readonly started_at: Date | string | null;
  readonly finished_at: Date | string | null;
  readonly error_json: unknown;
  readonly metrics_json: unknown;
  readonly artifacts_json: unknown;
  readonly created_at: Date | string | null;
  readonly updated_at: Date | string | null;
}

interface CodebaseScanFindingRow {
  readonly id: string;
  readonly scan_run_id: string;
  readonly repository_id: string;
  readonly source: WorkerFindingSource;
  readonly category: WorkerCodebaseScanFindingCategory;
  readonly severity: WorkerSeverity;
  readonly confidence: WorkerCodebaseScanFindingConfidence;
  readonly file_path: string | null;
  readonly start_line: number | null;
  readonly end_line: number | null;
  readonly title: string;
  readonly body: string;
  readonly evidence_json: unknown;
  readonly recommendation: string | null;
  readonly dedupe_key: string;
  readonly status: WorkerCodebaseScanFindingStatus;
  readonly first_seen_at: Date | string | null;
  readonly last_seen_at: Date | string | null;
  readonly resolved_at: Date | string | null;
  readonly created_at: Date | string | null;
  readonly updated_at: Date | string | null;
}

export class EmptyCodebaseScanStore implements CodebaseScanStore {
  async createScanRun(_input: CreateCodebaseScanRunInput): Promise<CodebaseScanRunRecord> {
    throw new Error("Codebase scan persistence is not configured.");
  }

  async createOrReuseActiveScanRun(_input: CreateCodebaseScanRunInput): Promise<CodebaseScanRunCreationResult> {
    throw new Error("Codebase scan persistence is not configured.");
  }

  async updateScanRun(_input: UpdateCodebaseScanRunInput): Promise<CodebaseScanRunRecord | null> {
    return null;
  }

  async upsertFinding(_input: UpsertCodebaseScanFindingInput): Promise<CodebaseScanFindingRecord> {
    throw new Error("Codebase scan persistence is not configured.");
  }

  async listOpenFindings(_input: ListOpenCodebaseScanFindingsInput): Promise<CodebaseScanFindingRecord[]> {
    return [];
  }

  async listReviewEnrichmentFindings(_input: ListReviewEnrichmentCodebaseScanFindingsInput): Promise<CodebaseScanFindingRecord[]> {
    return [];
  }

  async resolveStaleFindingsAfterSuccessfulScan(_input: ResolveStaleCodebaseScanFindingsInput): Promise<number> {
    return 0;
  }
}

export class PostgresCodebaseScanStore implements CodebaseScanStore {
  constructor(
    private readonly database: DatabaseExecutor,
    private readonly createId: () => string = randomUUID
  ) {}

  async createScanRun(input: CreateCodebaseScanRunInput): Promise<CodebaseScanRunRecord> {
    const result = await this.database.query<CodebaseScanRunRow>(
      `
INSERT INTO codebase_scan_runs (
  id,
  repository_id,
  installation_id,
  trigger,
  default_branch,
  commit_sha,
  status,
  metrics_json,
  artifacts_json
)
SELECT
  $1,
  r.id,
  r.installation_id,
  $2,
  $3,
  $4,
  $5,
  $6::jsonb,
  $7::jsonb
FROM repositories r
WHERE r.id = $8
RETURNING *
`,
      [
        this.createId(),
        input.trigger,
        input.defaultBranch,
        input.commitSha,
        input.status ?? "queued",
        JSON.stringify(input.metrics ?? {}),
        JSON.stringify(input.artifacts ?? []),
        input.repositoryId
      ]
    );
    const row = result.rows[0];

    if (row === undefined) {
      throw new Error(`Repository ${input.repositoryId} was not found for codebase scan.`);
    }

    return toScanRun(row);
  }

  async createOrReuseActiveScanRun(input: CreateCodebaseScanRunInput): Promise<CodebaseScanRunCreationResult> {
    const existing = await this.findActiveScanRun(input);

    if (existing !== null) {
      return { scanRun: existing, created: false };
    }

    try {
      return { scanRun: await this.createScanRun(input), created: true };
    } catch (error) {
      const raced = await this.findActiveScanRun(input);

      if (raced !== null) {
        return { scanRun: raced, created: false };
      }

      throw error;
    }
  }

  async updateScanRun(input: UpdateCodebaseScanRunInput): Promise<CodebaseScanRunRecord | null> {
    const assignments: string[] = ["updated_at = now()"];
    const values: unknown[] = [input.scanRunId];
    const append = (sql: string, value: unknown): void => {
      values.push(value);
      assignments.push(`${sql} = $${values.length}`);
    };
    const appendJson = (sql: string, value: unknown): void => {
      values.push(JSON.stringify(value));
      assignments.push(`${sql} = $${values.length}::jsonb`);
    };

    if (input.status !== undefined) {
      append("status", input.status);
    }
    if (input.startedAt !== undefined) {
      append("started_at", input.startedAt);
    }
    if (input.finishedAt !== undefined) {
      append("finished_at", input.finishedAt);
    }
    if (input.error !== undefined) {
      appendJson("error_json", input.error);
    }
    if (input.metrics !== undefined) {
      appendJson("metrics_json", input.metrics);
    }
    if (input.artifacts !== undefined) {
      appendJson("artifacts_json", input.artifacts);
    }

    const result = await this.database.query<CodebaseScanRunRow>(
      `
UPDATE codebase_scan_runs
SET ${assignments.join(",\n    ")}
WHERE id = $1
RETURNING *
`,
      values
    );

    return result.rows[0] === undefined ? null : toScanRun(result.rows[0]);
  }

  private async findActiveScanRun(input: CreateCodebaseScanRunInput): Promise<CodebaseScanRunRecord | null> {
    const result = await this.database.query<CodebaseScanRunRow>(
      input.commitSha === null
        ? `
SELECT *
FROM codebase_scan_runs
WHERE repository_id = $1
  AND trigger = $2
  AND commit_sha IS NULL
  AND status IN ('queued', 'running')
ORDER BY created_at ASC
LIMIT 1
`
        : `
SELECT *
FROM codebase_scan_runs
WHERE repository_id = $1
  AND commit_sha = $2
  AND status IN ('queued', 'running')
ORDER BY created_at ASC
LIMIT 1
`,
      input.commitSha === null ? [input.repositoryId, input.trigger] : [input.repositoryId, input.commitSha]
    );

    return result.rows[0] === undefined ? null : toScanRun(result.rows[0]);
  }

  async upsertFinding(input: UpsertCodebaseScanFindingInput): Promise<CodebaseScanFindingRecord> {
    const result = await this.database.query<CodebaseScanFindingRow>(
      `
INSERT INTO codebase_scan_findings (
  id,
  scan_run_id,
  repository_id,
  source,
  category,
  severity,
  confidence,
  file_path,
  start_line,
  end_line,
  title,
  body,
  evidence_json,
  recommendation,
  dedupe_key,
  status,
  last_seen_at,
  resolved_at
) VALUES (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7,
  $8,
  $9,
  $10,
  $11,
  $12,
  $13::jsonb,
  $14,
  $15,
  'open',
  now(),
  NULL
)
ON CONFLICT (repository_id, dedupe_key) DO UPDATE
SET scan_run_id = EXCLUDED.scan_run_id,
    source = EXCLUDED.source,
    category = EXCLUDED.category,
    severity = EXCLUDED.severity,
    confidence = EXCLUDED.confidence,
    file_path = EXCLUDED.file_path,
    start_line = EXCLUDED.start_line,
    end_line = EXCLUDED.end_line,
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    evidence_json = EXCLUDED.evidence_json,
    recommendation = EXCLUDED.recommendation,
    status = CASE
      WHEN codebase_scan_findings.status IN ('suppressed', 'false_positive') THEN codebase_scan_findings.status
      ELSE 'open'
    END,
    last_seen_at = now(),
    resolved_at = CASE
      WHEN codebase_scan_findings.status IN ('suppressed', 'false_positive') THEN codebase_scan_findings.resolved_at
      ELSE NULL
    END,
    updated_at = now()
RETURNING *
`,
      [
        this.createId(),
        input.scanRunId,
        input.repositoryId,
        input.source,
        input.category,
        input.severity,
        input.confidence,
        input.filePath,
        input.startLine,
        input.endLine,
        input.title,
        input.body,
        JSON.stringify(input.evidence),
        input.recommendation,
        input.dedupeKey
      ]
    );

    return toFinding(result.rows[0]);
  }

  async listOpenFindings(input: ListOpenCodebaseScanFindingsInput): Promise<CodebaseScanFindingRecord[]> {
    const conditions = ["repository_id = $1", "status = 'open'"];
    const values: unknown[] = [input.repositoryId];

    if (input.severities !== undefined && input.severities.length > 0) {
      values.push(input.severities);
      conditions.push(`severity = ANY($${values.length})`);
    }

    if (input.filePaths !== undefined && input.filePaths.length > 0) {
      values.push(input.filePaths);
      conditions.push(`file_path = ANY($${values.length})`);
    }

    values.push(input.limit ?? 100);
    const result = await this.database.query<CodebaseScanFindingRow>(
      `
SELECT *
FROM codebase_scan_findings
WHERE ${conditions.join(" AND ")}
ORDER BY
  CASE severity
    WHEN 'critical' THEN 0
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
    ELSE 4
  END,
  last_seen_at DESC,
  file_path ASC
LIMIT $${values.length}
`,
      values
    );

    return result.rows.map(toFinding);
  }

  async listReviewEnrichmentFindings(input: ListReviewEnrichmentCodebaseScanFindingsInput): Promise<CodebaseScanFindingRecord[]> {
    const changedFilePaths = uniqueStrings(input.changedFilePaths);
    const componentPrefixes = uniqueStrings(input.componentPrefixes);
    if (changedFilePaths.length === 0 && componentPrefixes.length === 0) {
      return [];
    }

    const values: unknown[] = [input.repositoryId];
    const relevanceConditions: string[] = [];
    const directMatchSql = buildDirectMatchSql("file_path", changedFilePaths, values);
    if (directMatchSql !== null) {
      relevanceConditions.push(directMatchSql);
    }

    const componentMatchSql = buildComponentMatchSql("file_path", componentPrefixes, values);
    if (componentMatchSql !== null) {
      relevanceConditions.push(`(severity IN ('critical', 'high') AND ${componentMatchSql})`);
    }

    values.push(input.limit ?? 12);
    const limitIndex = values.length;
    const result = await this.database.query<CodebaseScanFindingRow>(
      `
SELECT *
FROM codebase_scan_findings
WHERE repository_id = $1
  AND status = 'open'
  AND (${relevanceConditions.join(" OR ")})
ORDER BY
  CASE severity
    WHEN 'critical' THEN 0
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
    ELSE 4
  END,
  CASE WHEN ${directMatchSql ?? "false"} THEN 0 ELSE 1 END,
  last_seen_at DESC,
  file_path ASC
LIMIT $${limitIndex}
`,
      values
    );

    return result.rows.map(toFinding);
  }

  async resolveStaleFindingsAfterSuccessfulScan(input: ResolveStaleCodebaseScanFindingsInput): Promise<number> {
    const scanRun = await this.database.query<{ status: WorkerCodebaseScanStatus }>(
      "SELECT status FROM codebase_scan_runs WHERE id = $1 AND repository_id = $2",
      [input.scanRunId, input.repositoryId]
    );

    if (scanRun.rows[0]?.status !== "succeeded") {
      return 0;
    }

    const result = await this.database.query<{ id: string }>(
      `
UPDATE codebase_scan_findings
SET status = 'resolved',
    resolved_at = now(),
    updated_at = now()
WHERE repository_id = $1
  AND status = 'open'
  AND NOT (dedupe_key = ANY($2))
RETURNING id
`,
      [input.repositoryId, input.observedDedupeKeys]
    );

    return result.rows.length;
  }
}

function toScanRun(row: CodebaseScanRunRow): CodebaseScanRunRecord {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    installationId: row.installation_id,
    trigger: row.trigger,
    defaultBranch: row.default_branch,
    commitSha: row.commit_sha,
    status: row.status,
    startedAt: toIsoString(row.started_at),
    finishedAt: toIsoString(row.finished_at),
    error: normalizeJsonObject(row.error_json),
    metrics: normalizeJsonObject(row.metrics_json),
    artifacts: normalizeArtifactMetadata(row.artifacts_json),
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at)
  };
}

function buildDirectMatchSql(column: string, paths: readonly string[], values: unknown[]): string | null {
  if (paths.length === 0) {
    return null;
  }

  const placeholders = paths.map((path) => {
    values.push(path);
    return `$${values.length}`;
  });

  return `${column} IN (${placeholders.join(", ")})`;
}

function buildComponentMatchSql(column: string, prefixes: readonly string[], values: unknown[]): string | null {
  if (prefixes.length === 0) {
    return null;
  }

  const conditions = prefixes.map((prefix) => {
    values.push(prefix);
    const index = values.length;
    return `(${column} = $${index} OR ${column} LIKE $${index} || '/%')`;
  });

  return `(${column} IS NOT NULL AND (${conditions.join(" OR ")}))`;
}

function uniqueStrings(values: readonly string[]): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    selected.push(value);
    seen.add(value);
  }
  return selected;
}

function toFinding(row: CodebaseScanFindingRow): CodebaseScanFindingRecord {
  return {
    id: row.id,
    scanRunId: row.scan_run_id,
    repositoryId: row.repository_id,
    source: row.source,
    category: row.category,
    severity: row.severity,
    confidence: row.confidence,
    filePath: row.file_path,
    startLine: row.start_line,
    endLine: row.end_line,
    title: row.title,
    body: row.body,
    evidence: normalizeEvidence(row.evidence_json),
    recommendation: row.recommendation,
    dedupeKey: row.dedupe_key,
    status: row.status,
    firstSeenAt: toRequiredIsoString(row.first_seen_at),
    lastSeenAt: toRequiredIsoString(row.last_seen_at),
    resolvedAt: toIsoString(row.resolved_at),
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at)
  };
}

function normalizeArtifactMetadata(value: unknown): readonly WorkerCodebaseScanArtifactMetadataItem[] {
  return Array.isArray(value) ? (value as WorkerCodebaseScanArtifactMetadataItem[]) : [];
}

function normalizeEvidence(value: unknown): readonly WorkerCodebaseScanFindingEvidence[] {
  return Array.isArray(value) ? (value as WorkerCodebaseScanFindingEvidence[]) : [];
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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
