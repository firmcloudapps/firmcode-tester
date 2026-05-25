import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import {
  type RepositoryReviewConfiguration,
  type UpdateRepositoryReviewConfigurationRequest
} from "@firmcode/shared";
import {
  DASHBOARD_AUTH_STORE,
  roleHasDashboardCapability,
  type DashboardAuthStore
} from "../review-runs/dashboard-auth.store";
import { CodebaseScanEnqueueService } from "../codebase-scans/codebase-scan-enqueue.service";
import { REPOSITORIES_STORE, type RepositoriesStore } from "./repositories.store";

export interface RepositoryConfigurationRequestContext {
  readonly repositoryId: string;
  readonly workspaceId: string | null;
  readonly clerkUserId: string | null;
}

export interface RepositoryConfigurationUpdateContext extends RepositoryConfigurationRequestContext {
  readonly body: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UPDATE_FIELDS = [
  "automationEnabled",
  "codebaseScanEnabled",
  "codebaseScanCadenceHours",
  "codebaseScanIgnoredPaths",
  "codebaseScanSeverityThreshold",
  "codebaseScanMaxFiles",
  "codebaseScanMaxBytes",
  "draftPullRequestReviewsEnabled",
  "maxInlineComments",
  "severityThreshold",
  "semgrepEnabled",
  "treeSitterEnabled",
  "ciExplanationEnabled",
  "infrastructureReviewEnabled",
  "dryRunEnabled"
] as const;
const BOOLEAN_FIELDS = new Set<string>(
  UPDATE_FIELDS.filter(
    (field) =>
      ![
        "maxInlineComments",
        "severityThreshold",
        "codebaseScanCadenceHours",
        "codebaseScanIgnoredPaths",
        "codebaseScanSeverityThreshold",
        "codebaseScanMaxFiles",
        "codebaseScanMaxBytes"
      ].includes(field)
  )
);
const SEVERITY_THRESHOLDS = new Set<string>(["info", "low", "medium", "high", "critical"]);
const MAX_PATH_PATTERNS = 100;
const MAX_PATH_PATTERN_LENGTH = 240;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

@Injectable()
export class RepositoryConfigurationService {
  constructor(
    @Inject(REPOSITORIES_STORE) private readonly repositoriesStore: RepositoriesStore,
    @Inject(DASHBOARD_AUTH_STORE) private readonly dashboardAuthStore: DashboardAuthStore,
    private readonly codebaseScanEnqueueService?: CodebaseScanEnqueueService
  ) {}

  async getRepositoryConfiguration(input: RepositoryConfigurationRequestContext): Promise<RepositoryReviewConfiguration> {
    const context = await this.authorize(input, { requireManageConfiguration: false });
    const configuration = await this.repositoriesStore.getRepositoryConfiguration(context);

    if (configuration === null) {
      throw new NotFoundException("Repository not found");
    }

    return configuration;
  }

  async updateRepositoryConfiguration(input: RepositoryConfigurationUpdateContext): Promise<RepositoryReviewConfiguration> {
    const context = await this.authorize(input, { requireManageConfiguration: true });
    const updates = parseRepositoryConfigurationUpdate(input.body);
    const configuration = await this.repositoriesStore.updateRepositoryConfiguration({
      ...context,
      updates,
      updatedByClerkUserId: context.clerkUserId
    });

    if (configuration === null) {
      throw new NotFoundException("Repository not found");
    }

    if (updates.automationEnabled === false || updates.codebaseScanEnabled === false) {
      await this.codebaseScanEnqueueService?.removeRepositorySchedule(context.repositoryId);
    } else if (configuration.automationEnabled && configuration.codebaseScanEnabled) {
      if (updates.automationEnabled === true || updates.codebaseScanEnabled === true) {
        await this.codebaseScanEnqueueService?.enqueueInitialScanForRepository({
          repositoryId: context.repositoryId,
          requestedByClerkUserId: context.clerkUserId
        });
      }

      if (
        updates.automationEnabled !== undefined ||
        updates.codebaseScanEnabled !== undefined ||
        updates.codebaseScanCadenceHours !== undefined ||
        updates.codebaseScanIgnoredPaths !== undefined ||
        updates.codebaseScanSeverityThreshold !== undefined ||
        updates.codebaseScanMaxFiles !== undefined ||
        updates.codebaseScanMaxBytes !== undefined
      ) {
        await this.codebaseScanEnqueueService?.scheduleRepository(context.repositoryId);
      }
    }

    return configuration;
  }

  private async authorize(
    input: RepositoryConfigurationRequestContext,
    options: { requireManageConfiguration: boolean }
  ): Promise<{
    repositoryId: string;
    workspaceId: string;
    clerkUserId: string;
  }> {
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

    if (options.requireManageConfiguration && !roleHasDashboardCapability(membership.role, "manage_repository_configuration")) {
      throw new ForbiddenException("Workspace role cannot manage repository configuration");
    }

    return {
      repositoryId: input.repositoryId,
      workspaceId: input.workspaceId,
      clerkUserId: input.clerkUserId
    };
  }
}

function parseRepositoryConfigurationUpdate(body: unknown): UpdateRepositoryReviewConfigurationRequest {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestException("Repository configuration payload must be an object");
  }

  const payload = body as Record<string, unknown>;
  const allowedFields = new Set<string>(UPDATE_FIELDS);
  const updates: UpdateRepositoryReviewConfigurationRequest = {};

  for (const field of Object.keys(payload)) {
    if (!allowedFields.has(field)) {
      throw new BadRequestException(`Unknown repository configuration field: ${field}`);
    }
  }

  for (const field of BOOLEAN_FIELDS) {
    const value = payload[field];

    if (value === undefined) {
      continue;
    }

    if (typeof value !== "boolean") {
      throw new BadRequestException(`${field} must be a boolean`);
    }

    (updates as Record<string, boolean>)[field] = value;
  }

  if (payload.maxInlineComments !== undefined) {
    const maxInlineComments = payload.maxInlineComments;

    if (!Number.isInteger(maxInlineComments)) {
      throw new BadRequestException("maxInlineComments must be an integer");
    }

    if (typeof maxInlineComments !== "number" || maxInlineComments < 0 || maxInlineComments > 50) {
      throw new BadRequestException("maxInlineComments must be between 0 and 50");
    }

    updates.maxInlineComments = maxInlineComments;
  }

  if (payload.codebaseScanCadenceHours !== undefined) {
    const cadence = payload.codebaseScanCadenceHours;

    if (!Number.isInteger(cadence) || typeof cadence !== "number" || cadence < 1 || cadence > 720) {
      throw new BadRequestException("codebaseScanCadenceHours must be an integer between 1 and 720");
    }

    updates.codebaseScanCadenceHours = cadence;
  }

  if (payload.codebaseScanMaxFiles !== undefined) {
    const maxFiles = payload.codebaseScanMaxFiles;

    if (!Number.isInteger(maxFiles) || typeof maxFiles !== "number" || maxFiles < 1 || maxFiles > 5000) {
      throw new BadRequestException("codebaseScanMaxFiles must be an integer between 1 and 5000");
    }

    updates.codebaseScanMaxFiles = maxFiles;
  }

  if (payload.codebaseScanMaxBytes !== undefined) {
    const maxBytes = payload.codebaseScanMaxBytes;

    if (!Number.isInteger(maxBytes) || typeof maxBytes !== "number" || maxBytes < 1 || maxBytes > 100_000_000) {
      throw new BadRequestException("codebaseScanMaxBytes must be an integer between 1 and 100000000");
    }

    updates.codebaseScanMaxBytes = maxBytes;
  }

  if (payload.codebaseScanIgnoredPaths !== undefined) {
    updates.codebaseScanIgnoredPaths = parsePathPatterns("codebaseScanIgnoredPaths", payload.codebaseScanIgnoredPaths);
  }

  if (payload.severityThreshold !== undefined) {
    if (typeof payload.severityThreshold !== "string" || !SEVERITY_THRESHOLDS.has(payload.severityThreshold)) {
      throw new BadRequestException("severityThreshold must be info, low, medium, high, or critical");
    }

    updates.severityThreshold = payload.severityThreshold as UpdateRepositoryReviewConfigurationRequest["severityThreshold"];
  }

  if (payload.codebaseScanSeverityThreshold !== undefined) {
    if (
      typeof payload.codebaseScanSeverityThreshold !== "string" ||
      !SEVERITY_THRESHOLDS.has(payload.codebaseScanSeverityThreshold)
    ) {
      throw new BadRequestException("codebaseScanSeverityThreshold must be info, low, medium, high, or critical");
    }

    updates.codebaseScanSeverityThreshold =
      payload.codebaseScanSeverityThreshold as UpdateRepositoryReviewConfigurationRequest["codebaseScanSeverityThreshold"];
  }

  return updates;
}

function parsePathPatterns(label: string, value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException(`${label} must be an array of repository-relative paths`);
  }

  if (value.length > MAX_PATH_PATTERNS) {
    throw new BadRequestException(`${label} cannot contain more than ${MAX_PATH_PATTERNS} entries`);
  }

  return value.map((entry) => {
    if (typeof entry !== "string" || entry.length === 0 || entry.length > MAX_PATH_PATTERN_LENGTH) {
      throw new BadRequestException(`${label} entries must be non-empty strings up to ${MAX_PATH_PATTERN_LENGTH} characters`);
    }

    if (CONTROL_CHARACTER_PATTERN.test(entry)) {
      throw new BadRequestException(`${label} entries cannot contain control characters`);
    }

    if (entry.startsWith("/") || entry.startsWith("\\") || /^[A-Za-z]:[\\/]/.test(entry) || entry.split(/[\\/]+/).includes("..")) {
      throw new BadRequestException(`${label} entries must be repository-relative paths`);
    }

    return entry;
  });
}

function assertAuthenticated(input: RepositoryConfigurationRequestContext): asserts input is RepositoryConfigurationRequestContext & {
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
