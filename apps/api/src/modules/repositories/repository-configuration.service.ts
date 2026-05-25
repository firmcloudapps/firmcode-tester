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
  "draftPullRequestReviewsEnabled",
  "maxInlineComments",
  "severityThreshold",
  "semgrepEnabled",
  "treeSitterEnabled",
  "ciExplanationEnabled",
  "infrastructureReviewEnabled",
  "dryRunEnabled"
] as const;
const BOOLEAN_FIELDS = new Set<string>(UPDATE_FIELDS.filter((field) => field !== "maxInlineComments" && field !== "severityThreshold"));
const SEVERITY_THRESHOLDS = new Set<string>(["info", "low", "medium", "high", "critical"]);

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

    if (updates.automationEnabled === true) {
      await this.codebaseScanEnqueueService?.enqueueInitialScanForRepository({
        repositoryId: context.repositoryId,
        requestedByClerkUserId: context.clerkUserId
      });
    } else if (updates.automationEnabled === false) {
      await this.codebaseScanEnqueueService?.removeRepositorySchedule(context.repositoryId);
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

  if (payload.severityThreshold !== undefined) {
    if (typeof payload.severityThreshold !== "string" || !SEVERITY_THRESHOLDS.has(payload.severityThreshold)) {
      throw new BadRequestException("severityThreshold must be info, low, medium, high, or critical");
    }

    updates.severityThreshold = payload.severityThreshold as UpdateRepositoryReviewConfigurationRequest["severityThreshold"];
  }

  return updates;
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
