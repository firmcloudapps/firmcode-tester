import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Optional,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards
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
  DashboardAuth,
  hasDashboardCapability,
  resolveDashboardMembership,
  resolveRepositoryAccessScopeFromAuth,
  resolveRepositoryAccessScopeFromMembership,
  toDashboardServiceAuth,
  type DashboardAuthParam
} from "../auth/dashboard-auth.context";
import { DashboardAuthGuard } from "../auth/dashboard-auth.guard";
import {
  DASHBOARD_AUTH_STORE,
  EmptyDashboardAuthStore,
  type DashboardAuthStore,
  type DashboardMembership
} from "../review-runs/dashboard-auth.store";
import { CodebaseScanEnqueueService } from "../codebase-scans/codebase-scan-enqueue.service";
import { RepositoryConfigurationService } from "./repository-configuration.service";
import { REPOSITORIES_STORE, type RepositoriesStore } from "./repositories.store";

@Controller("api/repositories")
@UseGuards(DashboardAuthGuard)
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
  async listRepositories(
    @Query() query: Record<string, string | string[] | undefined>,
    @DashboardAuth() auth: DashboardAuthParam
  ): Promise<RepositoryListResponse> {
    const serviceAuth = toDashboardServiceAuth(auth);
    if (serviceAuth.workspaceId === null) {
      throw new UnauthorizedException("Dashboard authentication is required");
    }

    return this.repositoriesStore.listRepositories({
      ...parseRepositoryListFilters(query),
      workspaceId: serviceAuth.workspaceId,
      accessScope: resolveRepositoryAccessScopeFromAuth(auth)
    });
  }

  @Get(":id")
  async getRepositoryDetail(
    @Param("id") id: string,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<RepositoryDetailResponse> {
    assertUuid("repository ID", id);
    const membership = await this.requireMembership(auth, userIdHeader);
    const detail = await this.repositoriesStore.getRepositoryDetail({
      repositoryId: id,
      workspaceId: membership.workspaceId,
      accessScope: resolveRepositoryAccessScopeFromMembership(membership),
      permissions: {
        canManageConfiguration: hasMembershipCapability(membership, "manage_repository_configuration"),
        canRetryReviewRuns: hasMembershipCapability(membership, "retry_review_run"),
        canAccessRawArtifacts: hasMembershipCapability(membership, "access_raw_artifacts"),
        canTriggerCodebaseScans: hasMembershipCapability(membership, "trigger_codebase_scan"),
        canManageCodebaseScans: hasMembershipCapability(membership, "manage_codebase_scan_findings")
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
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<RepositoryActivityResponse> {
    assertUuid("repository ID", id);
    const membership = await this.requireMembership(auth, userIdHeader);
    const activity = await this.repositoriesStore.listRepositoryActivity({
      repositoryId: id,
      workspaceId: membership.workspaceId,
      accessScope: resolveRepositoryAccessScopeFromMembership(membership)
    });

    if (activity === null) {
      throw new NotFoundException("Repository not found");
    }

    return activity;
  }

  @Get(":id/configuration")
  async getRepositoryConfiguration(
    @Param("id") id: string,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<RepositoryReviewConfiguration> {
    if (this.configurationService === undefined) {
      throw new NotFoundException("Repository not found");
    }

    return this.configurationService.getRepositoryConfiguration({
      repositoryId: id,
      ...readServiceAuth(auth, userIdHeader)
    });
  }

  @Patch(":id/configuration")
  async updateRepositoryConfiguration(
    @Param("id") id: string,
    @Body() body: unknown,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<RepositoryReviewConfiguration> {
    if (this.configurationService === undefined) {
      throw new NotFoundException("Repository not found");
    }

    return this.configurationService.updateRepositoryConfiguration({
      repositoryId: id,
      ...readServiceAuth(auth, userIdHeader),
      body
    });
  }

  @Post(":id/codebase-scans")
  async enqueueCodebaseScan(
    @Param("id") id: string,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<CodebaseScanEnqueueResponse> {
    if (this.codebaseScanEnqueueService === undefined) {
      throw new NotFoundException("Repository not found");
    }

    return this.codebaseScanEnqueueService.enqueueManualScan({
      repositoryId: id,
      ...readServiceAuth(auth, userIdHeader)
    });
  }

  private async requireMembership(
    auth: DashboardAuthParam,
    userIdHeader: string | string[] | undefined
  ): Promise<DashboardMembership> {
    const membership = await resolveDashboardMembership(auth, userIdHeader, this.dashboardAuthStore, "Repository not found");
    assertUuid("workspace ID", membership.workspaceId);
    return membership;
  }
}

function readServiceAuth(auth: DashboardAuthParam, _userIdHeader: string | string[] | undefined) {
  return toDashboardServiceAuth(auth, _userIdHeader);
}

function hasMembershipCapability(
  membership: DashboardMembership,
  capability: Parameters<typeof hasDashboardCapability>[1]
): boolean {
  return hasDashboardCapability(
    {
      userId: membership.userId,
      orgId: null,
      provider: "insforge",
      workspaceId: membership.workspaceId,
      sessionId: null,
      role: membership.role,
      capabilities: [],
      billingCapabilities: [],
      email: null,
      emailVerified: false
    },
    capability
  );
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
