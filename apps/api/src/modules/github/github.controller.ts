import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type {
  GitHubInstallationListResponse,
  GitHubInstallationSyncResponse,
  GitHubOAuthStartResponse,
  GitHubOAuthStatusResponse,
  GitHubRepositorySyncResponse
} from "@firmcode/shared";
import {
  DashboardAuth,
  toDashboardServiceAuth,
  type DashboardAuthParam
} from "../auth/dashboard-auth.context";
import { DashboardAuthGuard } from "../auth/dashboard-auth.guard";
import { GitHubDashboardService } from "./github.service";

@Controller()
@UseGuards(DashboardAuthGuard)
export class GitHubDashboardController {
  constructor(private readonly githubService: GitHubDashboardService) {}

  @Get("auth/github")
  async startOAuth(
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<GitHubOAuthStartResponse> {
    return this.githubService.startOAuth({
      ...readServiceAuth(auth, userIdHeader)
    });
  }

  @Get("auth/github/callback")
  async completeOAuth(
    @Query("code") code: string | string[] | undefined,
    @Query("state") state: string | string[] | undefined,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<GitHubOAuthStatusResponse> {
    return this.githubService.completeOAuth({
      ...readServiceAuth(auth, userIdHeader),
      code: readSingleValue(code) ?? null,
      state: readSingleValue(state) ?? null
    });
  }

  @Get("api/github/oauth/status")
  async getOAuthStatus(
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<GitHubOAuthStatusResponse> {
    return this.githubService.getOAuthStatus({
      ...readServiceAuth(auth, userIdHeader)
    });
  }

  @Get("github/installations/callback")
  async connectInstallation(
    @Query("installation_id") installationId: string | string[] | undefined,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<GitHubInstallationSyncResponse> {
    return this.githubService.connectInstallation({
      ...readServiceAuth(auth, userIdHeader),
      installationId: readSingleValue(installationId) ?? null
    });
  }

  @Get("api/github/installations")
  async listInstallations(
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<GitHubInstallationListResponse> {
    return this.githubService.listInstallations({
      ...readServiceAuth(auth, userIdHeader)
    });
  }

  @Post("api/github/installations/sync")
  async syncInstallations(
    @Body() body: unknown,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<GitHubInstallationSyncResponse> {
    return this.githubService.syncInstallations({
      ...readServiceAuth(auth, userIdHeader),
      body
    });
  }

  @Post("api/github/repositories/:id/sync")
  async syncRepository(
    @Param("id") id: string,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<GitHubRepositorySyncResponse> {
    return this.githubService.syncRepository({
      repositoryId: id,
      ...readServiceAuth(auth, userIdHeader)
    });
  }

  @Post("api/repositories/:id/sync")
  async syncDashboardRepository(
    @Param("id") id: string,
    @DashboardAuth() auth: DashboardAuthParam,
    userIdHeader?: string | string[]
  ): Promise<GitHubRepositorySyncResponse> {
    return this.syncRepository(id, auth, userIdHeader);
  }
}

function readServiceAuth(auth: DashboardAuthParam, _userIdHeader: string | string[] | undefined) {
  return toDashboardServiceAuth(auth, _userIdHeader);
}

function readSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === "" ? undefined : value;
}
