import { BadRequestException, Controller, Get, Inject, Query } from "@nestjs/common";
import type { DashboardRepositoryListFilters, RepositoryListResponse } from "@firmcode/shared";
import { REPOSITORIES_STORE, type RepositoriesStore } from "./repositories.store";

@Controller("api/repositories")
export class RepositoriesController {
  constructor(@Inject(REPOSITORIES_STORE) private readonly repositoriesStore: RepositoriesStore) {}

  @Get()
  async listRepositories(@Query() query: Record<string, string | string[] | undefined>): Promise<RepositoryListResponse> {
    return this.repositoriesStore.listRepositories(parseRepositoryListFilters(query));
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
