import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { randomBytes } from "crypto";
import type {
  ApiRuntimeConfig,
  GitHubInstallationListResponse,
  GitHubInstallationSyncResponse,
  GitHubOAuthStartResponse,
  GitHubOAuthStatusResponse,
  GitHubRepositorySyncResponse
} from "@firmcode/shared";
import { API_RUNTIME_CONFIG } from "../../config/api-config.provider";
import {
  GITHUB_ACCOUNT_CLIENT,
  GITHUB_INSTALLATION_SYNC_CLIENT
} from "./github.tokens";
import type {
  GitHubAccountClient,
  GitHubInstallationSyncClient,
  GitHubRepositoryMetadata
} from "../../infrastructure/github/github-app-sync-client";
import {
  DASHBOARD_AUTH_STORE,
  roleHasDashboardCapability,
  type DashboardAuthStore,
  type DashboardMembership
} from "../review-runs/dashboard-auth.store";
import { CodebaseScanEnqueueService } from "../codebase-scans/codebase-scan-enqueue.service";
import {
  GITHUB_DASHBOARD_STORE,
  toRepositorySyncResponse,
  type GitHubDashboardStore,
  type WorkspaceRepositoryRecord
} from "./github.store";

export interface GitHubDashboardContext {
  readonly workspaceId: string | null;
  readonly userId: string | null;
}

export interface GitHubOAuthCallbackContext extends GitHubDashboardContext {
  readonly code: string | null;
  readonly state: string | null;
  readonly flow: "dashboard" | "installation";
}

export interface GitHubInstallationCallbackContext extends GitHubDashboardContext {
  readonly installationId: string | null;
}

export interface GitHubInstallationSyncContext extends GitHubDashboardContext {
  readonly body: unknown;
}

export interface GitHubRepositorySyncContext extends GitHubDashboardContext {
  readonly repositoryId: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_REDIRECT_URI = "http://localhost:3001/auth/github/callback";

@Injectable()
export class GitHubDashboardService {
  constructor(
    @Inject(GITHUB_DASHBOARD_STORE) private readonly store: GitHubDashboardStore,
    @Inject(DASHBOARD_AUTH_STORE) private readonly dashboardAuthStore: DashboardAuthStore,
    @Inject(GITHUB_ACCOUNT_CLIENT) private readonly accountClient: GitHubAccountClient,
    @Inject(GITHUB_INSTALLATION_SYNC_CLIENT) private readonly installationClient: GitHubInstallationSyncClient,
    @Inject(API_RUNTIME_CONFIG) private readonly config: ApiRuntimeConfig,
    @Optional() private readonly codebaseScanEnqueueService?: CodebaseScanEnqueueService
  ) { }

  async getOAuthStatus(input: GitHubDashboardContext): Promise<GitHubOAuthStatusResponse> {
    const membership = await this.requireMembership(input);
    return this.store.getOAuthStatus(membership.userId);
  }

  async startOAuth(input: GitHubDashboardContext): Promise<GitHubOAuthStartResponse> {
    const membership = await this.requireMembership(input);
    const github = this.requireGitHubConfig();
    const state = randomBytes(32).toString("base64url");
    const redirectUri = buildOAuthRedirectUri(this.config);
    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

    await this.store.createOAuthState({
      state,
      workspaceId: membership.workspaceId,
      userId: membership.userId,
      redirectUri,
      expiresAt
    });

    const authorizationUrl = new URL("https://github.com/login/oauth/authorize");
    authorizationUrl.searchParams.set("client_id", github.clientId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("scope", "read:user user:email");
    authorizationUrl.searchParams.set("state", state);

    return {
      authorizationUrl: authorizationUrl.toString(),
      expiresAt: expiresAt.toISOString()
    };
  }

  async completeOAuth(input: GitHubOAuthCallbackContext): Promise<GitHubOAuthStatusResponse> {
    const membership = await this.requireMembership(input);
    this.requireGitHubConfig();

    if (input.code === null || input.code.trim() === "") {
      throw new BadRequestException("GitHub OAuth code is required");
    }

    if (input.state === null || input.state.trim() === "") {
      if (input.flow === "installation") {
        return this.completeInstallationOAuth({ membership, code: input.code });
      }

      throw new BadRequestException("GitHub OAuth state is required");
    }

    const stateRecord = await this.store.consumeOAuthState({
      state: input.state,
      workspaceId: membership.workspaceId,
      userId: membership.userId
    });

    if (stateRecord === null) {
      throw new BadRequestException("GitHub OAuth state is invalid or expired");
    }

    const token = await this.accountClient.exchangeOAuthCode({
      code: input.code,
      redirectUri: stateRecord.redirectUri
    });
    const user = await this.accountClient.fetchOAuthUser(token.accessToken);
    const status = await this.store.upsertOAuthConnection({
      userId: membership.userId,
      user,
      scopes: token.scopes,
      accessToken: token.accessToken
    });

    if (roleHasDashboardCapability(membership.role, "manage_github_installations")) {
      await this.connectAccessibleInstallationsSafely(membership, token.accessToken);
    }

    return status;
  }

  async listInstallations(input: GitHubDashboardContext): Promise<GitHubInstallationListResponse> {
    const membership = await this.requireConnectedMembership(input);
    return { installations: await this.store.listWorkspaceInstallations(membership.workspaceId) };
  }

  async connectInstallation(input: GitHubInstallationCallbackContext): Promise<GitHubInstallationSyncResponse> {
    const membership = await this.requireInstallationManager(input);
    const installationId = parsePositiveInteger("installation ID", input.installationId);
    const existingOwner = await this.store.findInstallationOwner(installationId);

    if (existingOwner !== null && existingOwner.workspaceId !== null && existingOwner.workspaceId !== membership.workspaceId) {
      throw new ForbiddenException("GitHub installation belongs to another workspace");
    }

    const installation = await this.installationClient.fetchInstallation(installationId);
    const mappedInstallation = await this.store.upsertWorkspaceInstallation({
      workspaceId: membership.workspaceId,
      installation
    });
    const syncedRepositoryCount = await this.syncInstallationRepositories(
      mappedInstallation.id,
      mappedInstallation.installationId,
      membership.userId
    );

    return {
      installations: await this.store.listWorkspaceInstallations(membership.workspaceId),
      syncedRepositoryCount
    };
  }

  async syncInstallations(input: GitHubInstallationSyncContext): Promise<GitHubInstallationSyncResponse> {
    const membership = await this.requireInstallationManager(input);
    const payload = parseInstallationSyncPayload(input.body);
    const installations =
      payload.installationId === null
        ? await this.store.listWorkspaceInstallations(membership.workspaceId)
        : [await this.requireWorkspaceInstallation(membership.workspaceId, payload.installationId)];
    let syncedRepositoryCount = 0;

    for (const installation of installations) {
      const installationMetadata = await this.installationClient.fetchInstallation(installation.installationId);
      const mappedInstallation = await this.store.upsertWorkspaceInstallation({
        workspaceId: membership.workspaceId,
        installation: installationMetadata
      });

      syncedRepositoryCount += await this.syncInstallationRepositories(
        mappedInstallation.id,
        mappedInstallation.installationId,
        membership.userId
      );
    }

    return {
      installations: await this.store.listWorkspaceInstallations(membership.workspaceId),
      syncedRepositoryCount
    };
  }

  async syncRepository(input: GitHubRepositorySyncContext): Promise<GitHubRepositorySyncResponse> {
    const membership = await this.requireInstallationManager(input);
    assertUuid("repository ID", input.repositoryId);
    const repository = await this.store.findWorkspaceRepository({
      workspaceId: membership.workspaceId,
      repositoryId: input.repositoryId
    });

    if (repository === null) {
      throw new NotFoundException("Repository not found");
    }

    const repositories = await this.installationClient.fetchInstallationRepositories(repository.installationId);
    const latest = repositories.find((candidate) => candidate.githubRepositoryId === repository.githubRepositoryId);

    if (latest === undefined) {
      throw new NotFoundException("Repository was not found in the GitHub installation");
    }

    const synced = await this.store.upsertInstallationRepository({
      installationUuid: repository.installationUuid,
      repository: latest,
      preserveExistingEnabled: true,
      grantAccessToClerkUserId: membership.userId
    });

    if (synced.enabled) {
      await this.codebaseScanEnqueueService?.enqueueInitialScanForRepository({
        repositoryId: synced.id,
        requestedByUserId: membership.userId
      });
    }

    return toRepositorySyncResponse(synced);
  }

  private async syncInstallationRepositories(
    installationUuid: string,
    installationId: number,
    grantAccessToClerkUserId?: string
  ): Promise<number> {
    const repositories = await this.installationClient.fetchInstallationRepositories(installationId);

    for (const repository of repositories) {
      const synced = await this.store.upsertInstallationRepository({
        installationUuid,
        repository,
        preserveExistingEnabled: true,
        grantAccessToClerkUserId
      });

      if (synced.enabled) {
        await this.codebaseScanEnqueueService?.enqueueInitialScanForRepository({
          repositoryId: synced.id
        });
      }
    }

    return repositories.length;
  }

  private async connectAccessibleInstallations(membership: DashboardMembership, accessToken: string): Promise<void> {
    const installations = await this.accountClient.fetchAccessibleInstallations(accessToken);

    for (const installation of installations) {
      const existingOwner = await this.store.findInstallationOwner(installation.installationId);

      if (existingOwner !== null && existingOwner.workspaceId !== null && existingOwner.workspaceId !== membership.workspaceId) {
        continue;
      }

      const mappedInstallation = await this.store.upsertWorkspaceInstallation({
        workspaceId: membership.workspaceId,
        installation
      });

      await this.syncInstallationRepositories(
        mappedInstallation.id,
        mappedInstallation.installationId,
        membership.userId
      );
    }
  }

  private async completeInstallationOAuth(input: { membership: DashboardMembership; code: string }): Promise<GitHubOAuthStatusResponse> {
    const token = await this.accountClient.exchangeOAuthCode({
      code: input.code,
      redirectUri: buildOAuthRedirectUri(this.config)
    });
    const user = await this.accountClient.fetchOAuthUser(token.accessToken);
    const status = await this.store.upsertOAuthConnection({
      userId: input.membership.userId,
      user,
      scopes: token.scopes,
      accessToken: token.accessToken
    });

    if (roleHasDashboardCapability(input.membership.role, "manage_github_installations")) {
      await this.connectAccessibleInstallationsSafely(input.membership, token.accessToken);
    }

    return status;
  }

  private async connectAccessibleInstallationsSafely(membership: DashboardMembership, accessToken: string): Promise<void> {
    try {
      await this.connectAccessibleInstallations(membership, accessToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(
        `[github-oauth] GitHub App installation sync failed after OAuth connection: ${JSON.stringify({
          workspaceId: membership.workspaceId,
          userId: membership.userId,
          message
        })}`
      );
    }
  }

  private async requireWorkspaceInstallation(workspaceId: string, installationId: number): Promise<{
    id: string;
    installationId: number;
  }> {
    const installation = await this.store.findWorkspaceInstallation({ workspaceId, installationId });

    if (installation === null) {
      throw new NotFoundException("GitHub installation not found");
    }

    return {
      id: installation.id,
      installationId: installation.installationId
    };
  }

  private async requireConnectedMembership(input: GitHubDashboardContext): Promise<DashboardMembership> {
    const membership = await this.requireMembership(input);
    const oauth = await this.store.getOAuthStatus(membership.userId);

    if (!oauth.connected) {
      throw new ForbiddenException("GitHub OAuth connection is required");
    }

    return membership;
  }

  private async requireInstallationManager(input: GitHubDashboardContext): Promise<DashboardMembership> {
    const membership = await this.requireConnectedMembership(input);

    if (!roleHasDashboardCapability(membership.role, "manage_github_installations")) {
      throw new ForbiddenException("Workspace role cannot manage GitHub installations");
    }

    return membership;
  }

  private async requireMembership(input: GitHubDashboardContext): Promise<DashboardMembership> {
    assertAuthenticated(input);
    assertUuid("workspace ID", input.workspaceId);

    const membership = await this.dashboardAuthStore.findActiveMembership({
      workspaceId: input.workspaceId,
      userId: input.userId
    });

    if (membership === null) {
      throw new UnauthorizedException("Dashboard authentication is required");
    }

    return membership;
  }

  private requireGitHubConfig(): NonNullable<ApiRuntimeConfig["github"]> {
    if (this.config.github === null) {
      throw new ServiceUnavailableException("GitHub App OAuth is not configured");
    }

    return this.config.github;
  }
}

function parseInstallationSyncPayload(body: unknown): { installationId: number | null } {
  if (body === undefined || body === null) {
    return { installationId: null };
  }

  if (typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestException("GitHub installation sync payload must be an object");
  }

  const payload = body as Record<string, unknown>;
  const allowedFields = new Set(["installationId"]);

  for (const field of Object.keys(payload)) {
    if (!allowedFields.has(field)) {
      throw new BadRequestException(`Unknown GitHub installation sync field: ${field}`);
    }
  }

  return {
    installationId: payload.installationId === undefined ? null : parsePositiveIntegerValue("installation ID", payload.installationId)
  };
}

function buildOAuthRedirectUri(config: ApiRuntimeConfig): string {
  if (config.publicAppUrl !== undefined && config.publicAppUrl !== null) {
    return new URL("/api/auth/github/callback", config.publicAppUrl).toString();
  }

  if (config.publicApiUrl !== undefined && config.publicApiUrl !== null) {
    return new URL("/auth/github/callback", config.publicApiUrl).toString();
  }

  return DEFAULT_REDIRECT_URI;
}

function parsePositiveInteger(label: string, value: string | null): number {
  if (value === null || value.trim() === "") {
    throw new BadRequestException(`${label} is required`);
  }

  return parsePositiveIntegerValue(label, value);
}

function parsePositiveIntegerValue(label: string, value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new BadRequestException(`${label} must be a positive integer`);
  }

  return parsed;
}

function assertAuthenticated(input: GitHubDashboardContext): asserts input is GitHubDashboardContext & {
  workspaceId: string;
  userId: string;
} {
  if (input.workspaceId === null || input.userId === null) {
    throw new UnauthorizedException("Dashboard authentication is required");
  }
}

function assertUuid(label: string, value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${label} must be a UUID`);
  }
}
