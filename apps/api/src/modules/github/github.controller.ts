import { Body, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import type {
  GitHubInstallationListResponse,
  GitHubInstallationSyncResponse,
  GitHubOAuthStartResponse,
  GitHubOAuthStatusResponse,
  GitHubRepositorySyncResponse
} from "@firmcode/shared";
import { GitHubDashboardService } from "./github.service";

@Controller()
export class GitHubDashboardController {
  constructor(private readonly githubService: GitHubDashboardService) {}

  @Get("auth/github")
  async startOAuth(
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<GitHubOAuthStartResponse> {
    return this.githubService.startOAuth({
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null
    });
  }

  @Get("auth/github/callback")
  async completeOAuth(
    @Query("code") code: string | string[] | undefined,
    @Query("state") state: string | string[] | undefined,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<GitHubOAuthStatusResponse> {
    return this.githubService.completeOAuth({
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null,
      code: readSingleValue(code) ?? null,
      state: readSingleValue(state) ?? null
    });
  }

  @Get("api/github/oauth/status")
  async getOAuthStatus(
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<GitHubOAuthStatusResponse> {
    return this.githubService.getOAuthStatus({
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null
    });
  }

  @Get("github/installations/callback")
  async connectInstallation(
    @Query("installation_id") installationId: string | string[] | undefined,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<GitHubInstallationSyncResponse> {
    return this.githubService.connectInstallation({
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null,
      installationId: readSingleValue(installationId) ?? null
    });
  }

  @Get("api/github/installations")
  async listInstallations(
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<GitHubInstallationListResponse> {
    return this.githubService.listInstallations({
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null
    });
  }

  @Post("api/github/installations/sync")
  async syncInstallations(
    @Body() body: unknown,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<GitHubInstallationSyncResponse> {
    return this.githubService.syncInstallations({
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null,
      body
    });
  }

  @Post("api/github/repositories/:id/sync")
  async syncRepository(
    @Param("id") id: string,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<GitHubRepositorySyncResponse> {
    return this.githubService.syncRepository({
      repositoryId: id,
      workspaceId: readSingleValue(workspaceIdHeader) ?? null,
      clerkUserId: readSingleValue(userIdHeader) ?? null
    });
  }

  @Post("api/repositories/:id/sync")
  async syncDashboardRepository(
    @Param("id") id: string,
    @Headers("x-firmcode-workspace-id") workspaceIdHeader: string | string[] | undefined,
    @Headers("x-firmcode-user-id") userIdHeader: string | string[] | undefined
  ): Promise<GitHubRepositorySyncResponse> {
    return this.syncRepository(id, workspaceIdHeader, userIdHeader);
  }
}

function readSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === "" ? undefined : value;
}
