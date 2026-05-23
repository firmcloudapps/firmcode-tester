import { BadRequestException, Body, Controller, Get, Headers, Inject, NotFoundException, Param, Patch, Query } from "@nestjs/common";
import type {
  DashboardRepositoryListFilters,
  RepositoryListResponse,
  RepositoryReviewConfiguration
} from "@firmcode/shared";
import { RepositoryConfigurationService } from "./repository-configuration.service";
import { REPOSITORIES_STORE, type RepositoriesStore } from "./repositories.store";

@Controller("api/repositories")
export class RepositoriesController {
  constructor(
    @Inject(REPOSITORIES_STORE) private readonly repositoriesStore: RepositoriesStore,
    private readonly configurationService?: RepositoryConfigurationService
  ) {}

  @Get()
  async listRepositories(@Query() query: Record<string, string | string[] | undefined>): Promise<RepositoryListResponse> {
    return this.repositoriesStore.listRepositories(parseRepositoryListFilters(query));
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
