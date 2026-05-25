import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Optional,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import type {
  CodebaseScanEnqueueResponse,
  DashboardRepositoryListFilters,
  RepositoryActivityResponse,
  RepositoryDetailResponse,
  RepositoryListResponse,
  RepositoryReviewConfiguration
} from "@firmcode/shared";
import {
  DASHBOARD_AUTH_STORE,
  EmptyDashboardAuthStore,
  roleHasDashboardCapability,
  type DashboardAuthStore,
  type DashboardMembership
} from "../review-runs/dashboard-auth.store";
import { CodebaseScanEnqueueService } from "../codebase-scans/codebase-scan-enqueue.service";
import { RepositoryConfigurationService } from "./repository-configuration.service";
import { REPOSITORIES_STORE, type RepositoriesStore } from "./repositories.store";

@Controller("api/repositories")
export class RepositoriesController {
  private readonly dashboardAuthStore: DashboardAuthStore;
  private readonly configurationService?: RepositoryConfigurationService;

  constructor(
    @Inject(REPOSITORIES_STORE) private readonly repositoriesStore: RepositoriesStore,
    @Inject(DASHBOARD_AUTH_STORE) dashboardAuthOrConfiguration: DashboardAuthStore | RepositoryConfigurationService = new EmptyDashboardAuthStore(),
    @Optional()
    @Inject(RepositoryConfigurationService)
    configurationService?: RepositoryConfigurationService | CodebaseScanEnqueueService,
    @Optional()
    @Inject(CodebaseScanEnqueueService)
    private readonly codebaseScanEnqueueService?: CodebaseScanEnqueueService
  ) {
    if (dashboardAuthOrConfiguration instanceof RepositoryConfigurationService) {
      this.dashboardAuthStore = new EmptyDashboardAuthStore();
      this.configurationService = dashboardAuthOrConfiguration;
      this.codebaseScanEnqueueService =
        configurationService instanceof CodebaseScanEnqueueService ? configurationService : undefined;
      return;
    }

    this.dashboardAuthStore = dashboardAuthOrConfiguration;
    this.configurationService =
      configurationService instanceof RepositoryConfigurationService ? configurationService : undefined;
  }

  @Get()
  async listRepositories(@Query() query: Record<string, string | string[] | undefined>): Promise<RepositoryListResponse> {
    return this.repositoriesStore.listRepositories(parseRepositoryListFilters(query));
  }

  @Get(":id")
  async getRepositoryDetail(
    @Param("id") id: string,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<RepositoryDetailResponse> {
    assertUuid("repository ID", id);
    const membership = await this.requireMembership(workspaceIdHeader, userIdHeader);
    const detail = await this.repositoriesStore.getRepositoryDetail({
      repositoryId: id,
      workspaceId: membership.workspaceId,
      permissions: {
        canManageConfiguration: roleHasDashboardCapability(membership.role, "manage_repository_configuration"),
        canRetryReviewRuns: roleHasDashboardCapability(membership.role, "retry_review_run"),
        canAccessRawArtifacts: roleHasDashboardCapability(membership.role, "access_raw_artifacts")
      }
    });

    if (detail === null) {
      throw new NotFoundException("Repository not found");
    }

    return detail;
  }

  @Get(":id/activity")
  async getRepositoryActivity(
    @Param("id") id: string,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<RepositoryActivityResponse> {
    assertUuid("repository ID", id);
    const membership = await this.requireMembership(workspaceIdHeader, userIdHeader);
    const activity = await this.repositoriesStore.listRepositoryActivity({
      repositoryId: id,
      workspaceId: membership.workspaceId
    });

    if (activity === null) {
      throw new NotFoundException("Repository not found");
    }

    return activity;
  }

  @Get(":id/configuration")
  async getRepositoryConfiguration(
    @Param("id") id: string,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<RepositoryReviewConfiguration> {
    if (this.configurationService === undefined) {
      throw new NotFoundException("Repository not found");
    }

    return this.configurationService.getRepositoryConfiguration({
      repositoryId: id,
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null
    });
  }

  @Patch(":id/configuration")
  async updateRepositoryConfiguration(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<RepositoryReviewConfiguration> {
    if (this.configurationService === undefined) {
      throw new NotFoundException("Repository not found");
    }

    return this.configurationService.updateRepositoryConfiguration({
      repositoryId: id,
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null,
      body
    });
  }

  @Post(":id/codebase-scans")
  async enqueueCodebaseScan(
    @Param("id") id: string,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<CodebaseScanEnqueueResponse> {
    if (this.codebaseScanEnqueueService === undefined) {
      throw new NotFoundException("Repository not found");
    }

    return this.codebaseScanEnqueueService.enqueueManualScan({
      repositoryId: id,
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null
    });
  }

  private async requireMembership(
    workspaceIdHeader: string | string[] | undefined,
    userIdHeader: string | string[] | undefined
  ): Promise<DashboardMembership> {
    const workspaceId = readSingleValue(workspaceIdHeader) ?? null;
    const clerkUserId = readSingleValue(userIdHeader) ?? null;

    if (workspaceId === null || clerkUserId === null) {
      throw new UnauthorizedException("Dashboard authentication is required");
    }

    assertUuid("workspace ID", workspaceId);

    const membership = await this.dashboardAuthStore.findActiveMembership({ workspaceId, clerkUserId });

    if (membership === null) {
      throw new NotFoundException("Repository not found");
    }

    return membership;
  }
}

function parseRepositoryListFilters(query: Record<string, string | string[] | undefined>): DashboardRepositoryListFilters {
  return {
    enabled: parseBooleanFilter("enabled", readSingleValue(query.enabled)),
    private: parseBooleanFilter("private", readSingleValue(query.private)),
    language: readSingleValue(query.language)
  };
}

function parseBooleanFilter(name: string, value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new BadRequestException(`${name} must be true or false`);
}

function readSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === "" ? undefined : value;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(label: string, value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${label} must be a UUID`);
  }
}
