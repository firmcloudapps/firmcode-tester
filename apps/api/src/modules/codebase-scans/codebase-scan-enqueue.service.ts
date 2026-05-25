import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException
} from "@nestjs/common";
import { randomUUID } from "crypto";
import {
  WORKER_CODEBASE_SCAN_JOB_INPUT_SCHEMA_VERSION,
  type ApiRuntimeConfig,
  type CodebaseScanEnqueueResponse,
  type WorkerCodebaseScanTrigger
} from "@firmcode/shared";
import { API_RUNTIME_CONFIG } from "../../config/api-config.provider";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";
import {
  CODEBASE_SCAN_QUEUE,
  type CodebaseScanJobRecord,
  type CodebaseScanQueueProducer
} from "../queues/codebase-scan-queue";
import {
  DASHBOARD_AUTH_STORE,
  roleHasDashboardCapability,
  type DashboardAuthStore
} from "../review-runs/dashboard-auth.store";
import {
  CODEBASE_SCAN_STORE,
  type CodebaseScanRunRecord,
  type CodebaseScanStore
} from "./codebase-scan.store";

export const CODEBASE_SCAN_TARGET_STORE = Symbol("CODEBASE_SCAN_TARGET_STORE");
export const CODEBASE_SCAN_CORRELATION_ID_FACTORY = Symbol("CODEBASE_SCAN_CORRELATION_ID_FACTORY");

export interface CodebaseScanTargetStore {
  findRepositoryTarget(repositoryId: string): Promise<CodebaseScanRepositoryTarget | null>;
  findWorkspaceRepositoryTarget(input: { repositoryId: string; workspaceId: string }): Promise<CodebaseScanRepositoryTarget | null>;
}

export interface CodebaseScanRepositoryTarget {
  readonly repositoryId: string;
  readonly workspaceId: string | null;
  readonly installationUuid: string;
  readonly installationId: number;
  readonly repositoryFullName: string;
  readonly defaultBranch: string;
  readonly enabled: boolean;
  readonly codebaseScanEnabled: boolean;
  readonly codebaseScanCadenceHours: number;
  readonly codebaseScanIgnoredPaths: readonly string[];
  readonly codebaseScanSeverityThreshold: "info" | "low" | "medium" | "high" | "critical";
  readonly codebaseScanMaxFiles: number;
  readonly codebaseScanMaxBytes: number;
}

export interface ManualCodebaseScanRequest {
  readonly repositoryId: string;
  readonly workspaceId: string | null;
  readonly clerkUserId: string | null;
}

export interface InitialCodebaseScanRequest {
  readonly repositoryId: string;
  readonly requestedByClerkUserId?: string | null;
  readonly correlationId?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CodebaseScanEnqueueService {
  constructor(
    @Inject(CODEBASE_SCAN_STORE) private readonly scanStore: CodebaseScanStore,
    @Inject(CODEBASE_SCAN_TARGET_STORE) private readonly targetStore: CodebaseScanTargetStore,
    @Inject(CODEBASE_SCAN_QUEUE) private readonly queue: CodebaseScanQueueProducer,
    @Inject(DASHBOARD_AUTH_STORE) private readonly dashboardAuthStore: DashboardAuthStore,
    @Inject(API_RUNTIME_CONFIG) private readonly config: ApiRuntimeConfig,
    @Optional()
    @Inject(CODEBASE_SCAN_CORRELATION_ID_FACTORY)
    private readonly createCorrelationId: () => string = randomUUID
  ) {}

  async enqueueInitialScanForRepository(input: InitialCodebaseScanRequest): Promise<CodebaseScanEnqueueResponse | null> {
    assertUuid("repository ID", input.repositoryId);
    const target = await this.targetStore.findRepositoryTarget(input.repositoryId);

    if (target === null || !target.enabled || !target.codebaseScanEnabled) {
      return null;
    }

    const correlationId = input.correlationId ?? this.createCorrelationId();

    await this.scheduleRepositoryTarget(target, correlationId);

    return this.enqueueScanForTarget({
      target,
      trigger: "install",
      commitSha: null,
      requestedByClerkUserId: input.requestedByClerkUserId ?? null,
      correlationId
    });
  }

  async scheduleRepository(repositoryId: string): Promise<void> {
    assertUuid("repository ID", repositoryId);
    const target = await this.targetStore.findRepositoryTarget(repositoryId);

    if (target === null) {
      return;
    }

    if (target.enabled && target.codebaseScanEnabled) {
      await this.scheduleRepositoryTarget(target, this.createCorrelationId());
    } else {
      await this.queue.removeCodebaseScanSchedule(target.repositoryId);
    }
  }

  async removeRepositorySchedule(repositoryId: string): Promise<void> {
    assertUuid("repository ID", repositoryId);
    await this.queue.removeCodebaseScanSchedule(repositoryId);
  }

  async enqueueManualScan(input: ManualCodebaseScanRequest): Promise<CodebaseScanEnqueueResponse> {
    assertUuid("repository ID", input.repositoryId);
    assertAuthenticated(input);
    assertUuid("workspace ID", input.workspaceId);

    const membership = await this.dashboardAuthStore.findActiveMembership({
      workspaceId: input.workspaceId,
      clerkUserId: input.clerkUserId
    });

    if (membership === null) {
      throw new NotFoundException("Repository not found");
    }

    if (!roleHasDashboardCapability(membership.role, "trigger_codebase_scan")) {
      throw new ForbiddenException("Workspace role cannot trigger codebase scans");
    }

    const target = await this.targetStore.findWorkspaceRepositoryTarget({
      repositoryId: input.repositoryId,
      workspaceId: input.workspaceId
    });

    if (target === null) {
      throw new NotFoundException("Repository not found");
    }

    if (!target.enabled || !target.codebaseScanEnabled) {
      throw new ForbiddenException("Repository automation is disabled");
    }

    return this.enqueueScanForTarget({
      target,
      trigger: "manual",
      commitSha: null,
      requestedByClerkUserId: input.clerkUserId,
      correlationId: this.createCorrelationId()
    });
  }

  private async scheduleRepositoryTarget(target: CodebaseScanRepositoryTarget, correlationId: string): Promise<void> {
    await this.queue.scheduleCodebaseScan(
      {
        schemaVersion: WORKER_CODEBASE_SCAN_JOB_INPUT_SCHEMA_VERSION,
        scanRunId: null,
        repositoryId: target.repositoryId,
        installationId: target.installationId,
        repositoryFullName: target.repositoryFullName,
        defaultBranch: target.defaultBranch,
        commitSha: null,
        trigger: "scheduled",
        correlationId,
        requestedByClerkUserId: null,
        scanConfig: toScanJobConfig(target)
      },
      target.codebaseScanCadenceHours
    );
  }

  private async enqueueScanForTarget(input: {
    readonly target: CodebaseScanRepositoryTarget;
    readonly trigger: WorkerCodebaseScanTrigger;
    readonly commitSha: string | null;
    readonly requestedByClerkUserId: string | null;
    readonly correlationId: string;
  }): Promise<CodebaseScanEnqueueResponse> {
    const startedAt = Date.now();
    const creation = await this.scanStore.createOrReuseActiveScanRun({
      repositoryId: input.target.repositoryId,
      trigger: input.trigger,
      defaultBranch: input.target.defaultBranch,
      commitSha: input.commitSha,
      metrics: {
        enqueue: {
          correlationId: input.correlationId,
          repositoryFullName: input.target.repositoryFullName,
          trigger: input.trigger
        }
      }
    });
    let job: CodebaseScanJobRecord | null = null;

    try {
      job = await this.queue.enqueueCodebaseScan({
        schemaVersion: WORKER_CODEBASE_SCAN_JOB_INPUT_SCHEMA_VERSION,
        scanRunId: creation.scanRun.id,
        repositoryId: input.target.repositoryId,
        installationId: input.target.installationId,
        repositoryFullName: input.target.repositoryFullName,
        defaultBranch: input.target.defaultBranch,
        commitSha: input.commitSha,
        trigger: input.trigger,
        correlationId: input.correlationId,
        requestedByClerkUserId: input.requestedByClerkUserId,
        scanConfig: toScanJobConfig(input.target)
      });

      logScanQueueEvent("codebase_scan.enqueue", creation.scanRun, input.target, input.correlationId, Date.now() - startedAt, job.id);

      return toResponse(creation.scanRun, input.target, input.correlationId, creation.created, job.id);
    } catch (error) {
      const failedRun =
        (await this.scanStore.updateScanRun({
          scanRunId: creation.scanRun.id,
          status: "failed",
          finishedAt: new Date().toISOString(),
          error: {
            code: "enqueue_failed",
            message: error instanceof Error ? error.message : "unknown enqueue error",
            correlationId: input.correlationId
          },
          metrics: {
            durationMs: Date.now() - startedAt,
            enqueueFailed: true
          }
        })) ?? creation.scanRun;
      logScanQueueEvent("codebase_scan.enqueue_failed", failedRun, input.target, input.correlationId, Date.now() - startedAt, null);
      throw error;
    }
  }
}

export class NoopCodebaseScanEnqueueService {
  async enqueueInitialScanForRepository(): Promise<CodebaseScanEnqueueResponse | null> {
    return null;
  }

  async scheduleRepository(): Promise<void> {
    return undefined;
  }

  async removeRepositorySchedule(): Promise<void> {
    return undefined;
  }
}

export class EmptyCodebaseScanTargetStore implements CodebaseScanTargetStore {
  async findRepositoryTarget(): Promise<CodebaseScanRepositoryTarget | null> {
    return null;
  }

  async findWorkspaceRepositoryTarget(): Promise<CodebaseScanRepositoryTarget | null> {
    return null;
  }
}

export class PostgresCodebaseScanTargetStore implements CodebaseScanTargetStore {
  constructor(private readonly database: DatabaseExecutor) {}

  async findRepositoryTarget(repositoryId: string): Promise<CodebaseScanRepositoryTarget | null> {
    const result = await this.database.query<CodebaseScanTargetRow>(
      `
SELECT
  r.id AS repository_id,
  gi.workspace_id,
  gi.id AS installation_uuid,
  gi.installation_id,
  r.full_name,
  r.default_branch,
  r.enabled,
  COALESCE(rc.codebase_scan_enabled, true) AS codebase_scan_enabled,
  COALESCE(rc.codebase_scan_cadence_hours, $2) AS codebase_scan_cadence_hours,
  COALESCE(rc.codebase_scan_ignored_paths_json, '[]'::jsonb) AS codebase_scan_ignored_paths_json,
  COALESCE(rc.codebase_scan_severity_threshold, 'medium') AS codebase_scan_severity_threshold,
  COALESCE(rc.codebase_scan_max_files, 500) AS codebase_scan_max_files,
  COALESCE(rc.codebase_scan_max_bytes, 10000000) AS codebase_scan_max_bytes
FROM repositories r
JOIN github_installations gi ON gi.id = r.installation_id
LEFT JOIN repository_review_configurations rc ON rc.repository_id = r.id
WHERE r.id = $1
`,
      [repositoryId, 24]
    );

    return result.rows[0] === undefined ? null : toTarget(result.rows[0]);
  }

  async findWorkspaceRepositoryTarget(input: { repositoryId: string; workspaceId: string }): Promise<CodebaseScanRepositoryTarget | null> {
    const result = await this.database.query<CodebaseScanTargetRow>(
      `
SELECT
  r.id AS repository_id,
  gi.workspace_id,
  gi.id AS installation_uuid,
  gi.installation_id,
  r.full_name,
  r.default_branch,
  r.enabled,
  COALESCE(rc.codebase_scan_enabled, true) AS codebase_scan_enabled,
  COALESCE(rc.codebase_scan_cadence_hours, $3) AS codebase_scan_cadence_hours,
  COALESCE(rc.codebase_scan_ignored_paths_json, '[]'::jsonb) AS codebase_scan_ignored_paths_json,
  COALESCE(rc.codebase_scan_severity_threshold, 'medium') AS codebase_scan_severity_threshold,
  COALESCE(rc.codebase_scan_max_files, 500) AS codebase_scan_max_files,
  COALESCE(rc.codebase_scan_max_bytes, 10000000) AS codebase_scan_max_bytes
FROM repositories r
JOIN github_installations gi ON gi.id = r.installation_id
LEFT JOIN repository_review_configurations rc ON rc.repository_id = r.id
WHERE r.id = $1
  AND gi.workspace_id = $2
`,
      [input.repositoryId, input.workspaceId, 24]
    );

    return result.rows[0] === undefined ? null : toTarget(result.rows[0]);
  }
}

interface CodebaseScanTargetRow {
  readonly repository_id: string;
  readonly workspace_id: string | null;
  readonly installation_uuid: string;
  readonly installation_id: string | number;
  readonly full_name: string;
  readonly default_branch: string;
  readonly enabled: boolean;
  readonly codebase_scan_enabled: boolean;
  readonly codebase_scan_cadence_hours: number;
  readonly codebase_scan_ignored_paths_json: unknown;
  readonly codebase_scan_severity_threshold: "info" | "low" | "medium" | "high" | "critical";
  readonly codebase_scan_max_files: number;
  readonly codebase_scan_max_bytes: number;
}

function toTarget(row: CodebaseScanTargetRow): CodebaseScanRepositoryTarget {
  return {
    repositoryId: row.repository_id,
    workspaceId: row.workspace_id,
    installationUuid: row.installation_uuid,
    installationId: Number(row.installation_id),
    repositoryFullName: row.full_name,
    defaultBranch: row.default_branch,
    enabled: row.enabled,
    codebaseScanEnabled: row.codebase_scan_enabled,
    codebaseScanCadenceHours: Number(row.codebase_scan_cadence_hours),
    codebaseScanIgnoredPaths: normalizeStringArray(row.codebase_scan_ignored_paths_json),
    codebaseScanSeverityThreshold: row.codebase_scan_severity_threshold,
    codebaseScanMaxFiles: Number(row.codebase_scan_max_files),
    codebaseScanMaxBytes: Number(row.codebase_scan_max_bytes)
  };
}

function toScanJobConfig(target: CodebaseScanRepositoryTarget) {
  return {
    ignoredPaths: target.codebaseScanIgnoredPaths,
    severityThreshold: target.codebaseScanSeverityThreshold,
    maxFiles: target.codebaseScanMaxFiles,
    maxBytes: target.codebaseScanMaxBytes
  };
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function toResponse(
  scanRun: CodebaseScanRunRecord,
  target: CodebaseScanRepositoryTarget,
  correlationId: string,
  created: boolean,
  jobId: string | null
): CodebaseScanEnqueueResponse {
  return {
    scanRunId: scanRun.id,
    jobId,
    repositoryId: target.repositoryId,
    repositoryFullName: target.repositoryFullName,
    trigger: scanRun.trigger,
    status: scanRun.status,
    commitSha: scanRun.commitSha,
    correlationId,
    created,
    duplicate: !created
  };
}

function logScanQueueEvent(
  event: string,
  scanRun: CodebaseScanRunRecord,
  target: CodebaseScanRepositoryTarget,
  correlationId: string,
  durationMs: number,
  jobId: string | null
): void {
  console.info(
    JSON.stringify({
      event,
      scanRunId: scanRun.id,
      jobId,
      repositoryId: target.repositoryId,
      repositoryFullName: target.repositoryFullName,
      trigger: scanRun.trigger,
      commitSha: scanRun.commitSha,
      status: scanRun.status,
      correlationId,
      durationMs
    })
  );
}

function assertAuthenticated(input: ManualCodebaseScanRequest): asserts input is ManualCodebaseScanRequest & {
  workspaceId: string;
  clerkUserId: string;
} {
  if (input.workspaceId === null || input.clerkUserId === null) {
    throw new UnauthorizedException("Dashboard authentication is required");
  }
}

function assertUuid(label: string, value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${label} must be a UUID`);
  }
}
