import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  type RepositoryReviewConfiguration,
  type UpdateRepositoryReviewConfigurationRequest
} from "@firmcode/shared";
import {
  DashboardAuthorizationService,
  type DashboardRequestContext
} from "../auth/dashboard-authorization.service";
import { REPOSITORIES_STORE, type RepositoriesStore } from "./repositories.store";

export interface RepositoryConfigurationRequestContext {
  readonly repositoryId: string;
  readonly auth: DashboardRequestContext;
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
    private readonly dashboardAuthorization: DashboardAuthorizationService
  ) {}

  async getRepositoryConfiguration(input: RepositoryConfigurationRequestContext): Promise<RepositoryReviewConfiguration> {
    const context = await this.authorize(input);
    const configuration = await this.repositoriesStore.getRepositoryConfiguration(context);

    if (configuration === null) {
      throw new NotFoundException("Repository not found");
    }

    return configuration;
  }

  async updateRepositoryConfiguration(input: RepositoryConfigurationUpdateContext): Promise<RepositoryReviewConfiguration> {
    const context = await this.authorize(input);
    const updates = parseRepositoryConfigurationUpdate(input.body);
    const configuration = await this.repositoriesStore.updateRepositoryConfiguration({
      ...context,
      updates,
      updatedByClerkUserId: context.clerkUserId
    });

    if (configuration === null) {
      throw new NotFoundException("Repository not found");
    }

    return configuration;
  }

  private async authorize(input: RepositoryConfigurationRequestContext): Promise<{
    repositoryId: string;
    workspaceId: string;
    clerkUserId: string;
  }> {
    assertUuid("repository ID", input.repositoryId);
    const context = await this.dashboardAuthorization.requireWorkspaceMembership(input.auth, {
      capability: "manage_repository_configuration",
      concealMembershipFailure: true,
      notFoundMessage: "Repository not found",
      forbiddenMessage: "Workspace role cannot manage repository configuration"
    });

    return {
      repositoryId: input.repositoryId,
      workspaceId: context.workspaceId,
      clerkUserId: context.clerkUserId
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

function assertUuid(label: string, value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${label} must be a UUID`);
  }
}
