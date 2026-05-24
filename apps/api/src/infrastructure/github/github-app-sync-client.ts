import type { GitHubAppConfig } from "@firmcode/shared";
import { createGitHubAppJwt } from "./github-pr-activity-publisher";

export interface GitHubOAuthTokenExchange {
  readonly accessToken: string;
  readonly scopes: string[];
}

export interface GitHubOAuthUser {
  readonly githubUserId: number;
  readonly login: string;
  readonly name: string | null;
  readonly avatarUrl: string | null;
}

export interface GitHubInstallationMetadata {
  readonly installationId: number;
  readonly accountLogin: string | null;
  readonly accountType: string | null;
  readonly permissionsJson: Record<string, unknown>;
}

export interface GitHubRepositoryMetadata {
  readonly githubRepositoryId: number;
  readonly owner: string;
  readonly name: string;
  readonly fullName: string;
  readonly private: boolean;
  readonly defaultBranch: string;
}

export interface GitHubAccountClient {
  exchangeOAuthCode(input: { code: string; redirectUri: string }): Promise<GitHubOAuthTokenExchange>;
  fetchOAuthUser(accessToken: string): Promise<GitHubOAuthUser>;
}

export interface GitHubInstallationSyncClient {
  fetchInstallation(installationId: number): Promise<GitHubInstallationMetadata>;
  fetchInstallationRepositories(installationId: number): Promise<GitHubRepositoryMetadata[]>;
}

export class NoopGitHubAccountClient implements GitHubAccountClient {
  async exchangeOAuthCode(): Promise<GitHubOAuthTokenExchange> {
    throw new GitHubSyncClientError("GitHub OAuth is not configured.");
  }

  async fetchOAuthUser(): Promise<GitHubOAuthUser> {
    throw new GitHubSyncClientError("GitHub OAuth is not configured.");
  }
}

export class NoopGitHubInstallationSyncClient implements GitHubInstallationSyncClient {
  async fetchInstallation(): Promise<GitHubInstallationMetadata> {
    throw new GitHubSyncClientError("GitHub App sync is not configured.");
  }

  async fetchInstallationRepositories(): Promise<GitHubRepositoryMetadata[]> {
    throw new GitHubSyncClientError("GitHub App sync is not configured.");
  }
}

export class GitHubSyncClientError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly githubMessage: string | null = null
  ) {
    super(message);
    this.name = "GitHubSyncClientError";
  }
}

interface GitHubOAuthTokenResponse {
  readonly access_token?: unknown;
  readonly scope?: unknown;
}

interface GitHubInstallationTokenResponse {
  readonly token?: unknown;
}

export class GitHubApiAccountClient implements GitHubAccountClient {
  constructor(private readonly github: GitHubAppConfig) {}

  async exchangeOAuthCode(input: { code: string; redirectUri: string }): Promise<GitHubOAuthTokenExchange> {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "firmcodeai"
      },
      body: JSON.stringify({
        client_id: this.github.clientId,
        client_secret: this.github.clientSecret,
        code: input.code,
        redirect_uri: input.redirectUri
      })
    });

    if (!response.ok) {
      throw new GitHubSyncClientError(`GitHub OAuth token exchange failed with status ${response.status}.`, response.status);
    }

    const payload = (await response.json()) as GitHubOAuthTokenResponse;

    if (typeof payload.access_token !== "string" || payload.access_token.length === 0) {
      throw new GitHubSyncClientError("GitHub OAuth token exchange response did not include an access token.");
    }

    return {
      accessToken: payload.access_token,
      scopes: typeof payload.scope === "string" && payload.scope.length > 0 ? payload.scope.split(",").map((scope) => scope.trim()) : []
    };
  }

  async fetchOAuthUser(accessToken: string): Promise<GitHubOAuthUser> {
    const response = await requestGitHubJson<unknown>({
      method: "GET",
      token: accessToken,
      path: "/user"
    });
    const normalized = normalizeOAuthUser(response);

    if (normalized === null) {
      throw new GitHubSyncClientError("GitHub OAuth user response was malformed.");
    }

    return normalized;
  }
}

export class GitHubAppInstallationSyncClient implements GitHubInstallationSyncClient {
  constructor(private readonly github: GitHubAppConfig) {}

  async fetchInstallation(installationId: number): Promise<GitHubInstallationMetadata> {
    const response = await requestGitHubJson<unknown>({
      method: "GET",
      jwt: createGitHubAppJwt(this.github),
      path: `/app/installations/${installationId}`
    });
    const normalized = normalizeInstallation(response);

    if (normalized === null) {
      throw new GitHubSyncClientError("GitHub installation response was malformed.");
    }

    return normalized;
  }

  async fetchInstallationRepositories(installationId: number): Promise<GitHubRepositoryMetadata[]> {
    const token = await this.createInstallationAccessToken(installationId);
    const repositories: GitHubRepositoryMetadata[] = [];
    let page = 1;

    while (true) {
      const response = await requestGitHubJson<{ repositories?: unknown }>({
        method: "GET",
        token,
        path: `/installation/repositories?per_page=100&page=${page}`
      });
      const pageItems = Array.isArray(response.repositories) ? response.repositories : [];

      repositories.push(...pageItems.map(normalizeRepository).filter((repo): repo is GitHubRepositoryMetadata => repo !== null));

      if (pageItems.length < 100) {
        break;
      }

      page += 1;
    }

    return repositories;
  }

  private async createInstallationAccessToken(installationId: number): Promise<string> {
    const response = await requestGitHubJson<GitHubInstallationTokenResponse>({
      method: "POST",
      jwt: createGitHubAppJwt(this.github),
      path: `/app/installations/${installationId}/access_tokens`
    });

    if (typeof response.token !== "string" || response.token.length === 0) {
      throw new GitHubSyncClientError("GitHub installation token response did not include a token.");
    }

    return response.token;
  }
}

async function requestGitHubJson<T>(input: {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly token?: string;
  readonly jwt?: string;
}): Promise<T> {
  const response = await fetch(`https://api.github.com${input.path}`, {
    method: input.method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: input.token ? `Bearer ${input.token}` : `Bearer ${input.jwt ?? ""}`,
      "content-type": "application/json",
      "user-agent": "firmcodeai",
      "x-github-api-version": "2022-11-28"
    }
  });

  if (!response.ok) {
    const githubMessage = await readGitHubErrorMessage(response);
    const detail = githubMessage === null ? "" : ` GitHub message: ${githubMessage}`;
    throw new GitHubSyncClientError(`GitHub API request failed with status ${response.status}.${detail}`, response.status, githubMessage);
  }

  return (await response.json()) as T;
}

function normalizeOAuthUser(value: unknown): GitHubOAuthUser | null {
  if (!isObject(value)) {
    return null;
  }

  const githubUserId = numberValue(value, "id");
  const login = stringValue(value, "login");

  if (githubUserId === null || login === null) {
    return null;
  }

  return {
    githubUserId,
    login,
    name: stringValue(value, "name"),
    avatarUrl: stringValue(value, "avatar_url")
  };
}

function normalizeInstallation(value: unknown): GitHubInstallationMetadata | null {
  if (!isObject(value)) {
    return null;
  }

  const installationId = numberValue(value, "id");
  const account = objectValue(value, "account");

  if (installationId === null) {
    return null;
  }

  return {
    installationId,
    accountLogin: stringValue(account, "login"),
    accountType: stringValue(account, "type"),
    permissionsJson: objectValue(value, "permissions") ?? {}
  };
}

function normalizeRepository(value: unknown): GitHubRepositoryMetadata | null {
  if (!isObject(value)) {
    return null;
  }

  const githubRepositoryId = numberValue(value, "id");
  const name = stringValue(value, "name");
  const fullName = stringValue(value, "full_name");
  const defaultBranch = stringValue(value, "default_branch");
  const owner = objectValue(value, "owner");
  const ownerLogin = stringValue(owner, "login");
  const isPrivate = booleanValue(value, "private");

  if (
    githubRepositoryId === null ||
    name === null ||
    fullName === null ||
    defaultBranch === null ||
    ownerLogin === null ||
    isPrivate === null
  ) {
    return null;
  }

  return {
    githubRepositoryId,
    owner: ownerLogin,
    name,
    fullName,
    private: isPrivate,
    defaultBranch
  };
}

async function readGitHubErrorMessage(response: Response): Promise<string | null> {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    return isObject(parsed) && typeof parsed.message === "string" ? parsed.message : null;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function objectValue(value: unknown, key: string): Record<string, unknown> | null {
  return isObject(value) && isObject(value[key]) ? value[key] : null;
}

function stringValue(value: unknown, key: string): string | null {
  return isObject(value) && typeof value[key] === "string" ? value[key] : null;
}

function numberValue(value: unknown, key: string): number | null {
  return isObject(value) && Number.isSafeInteger(value[key]) && Number(value[key]) > 0 ? Number(value[key]) : null;
}

function booleanValue(value: unknown, key: string): boolean | null {
  return isObject(value) && typeof value[key] === "boolean" ? value[key] : null;
}
