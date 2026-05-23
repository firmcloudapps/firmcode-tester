import type { ApiRuntimeConfig, GitHubAppConfig } from "@firmcode/shared";
import { createGitHubAppJwt } from "./github-pr-activity-publisher";

export const GITHUB_PUSH_PR_RESOLVER = Symbol("GITHUB_PUSH_PR_RESOLVER");

export interface ResolvePushPullRequestsInput {
  readonly installationId: number;
  readonly repositoryFullName: string;
  readonly commitSha: string;
}

export interface GitHubAssociatedPullRequest {
  readonly githubPullRequestId: number;
  readonly number: number;
  readonly title: string;
  readonly authorLogin: string;
  readonly baseRef: string;
  readonly headRef: string;
  readonly baseSha: string;
  readonly headSha: string;
  readonly state: string;
  readonly draft: boolean;
}

export interface GitHubPushPullRequestResolver {
  resolveAssociatedPullRequests(input: ResolvePushPullRequestsInput): Promise<GitHubAssociatedPullRequest[]>;
}

export class NoopGitHubPushPullRequestResolver implements GitHubPushPullRequestResolver {
  async resolveAssociatedPullRequests(_input: ResolvePushPullRequestsInput): Promise<GitHubAssociatedPullRequest[]> {
    return [];
  }
}

export class GitHubPushPullRequestResolutionError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly githubMessage: string | null = null
  ) {
    super(message);
    this.name = "GitHubPushPullRequestResolutionError";
  }
}

interface GitHubInstallationTokenResponse {
  readonly token?: unknown;
}

type JsonObject = Record<string, unknown>;

export class GitHubAppPushPullRequestResolver implements GitHubPushPullRequestResolver {
  constructor(private readonly github: GitHubAppConfig) {}

  static fromConfig(config: ApiRuntimeConfig): GitHubPushPullRequestResolver {
    if (config.github === null) {
      return new NoopGitHubPushPullRequestResolver();
    }

    return new GitHubAppPushPullRequestResolver(config.github);
  }

  async resolveAssociatedPullRequests(input: ResolvePushPullRequestsInput): Promise<GitHubAssociatedPullRequest[]> {
    const [owner, repo] = splitRepositoryFullName(input.repositoryFullName);
    const token = await this.createInstallationAccessToken(input.installationId);
    const pullRequests = await this.request<unknown[]>({
      method: "GET",
      token,
      path: `/repos/${owner}/${repo}/commits/${encodeURIComponent(input.commitSha)}/pulls?per_page=100`
    });

    return pullRequests
      .map((pullRequest) => normalizeAssociatedPullRequest(pullRequest))
      .filter((pullRequest): pullRequest is GitHubAssociatedPullRequest => pullRequest !== null);
  }

  private async createInstallationAccessToken(installationId: number): Promise<string> {
    const response = await this.request<GitHubInstallationTokenResponse>({
      method: "POST",
      jwt: createGitHubAppJwt(this.github),
      path: `/app/installations/${installationId}/access_tokens`
    });

    if (typeof response.token !== "string" || response.token.length === 0) {
      throw new GitHubPushPullRequestResolutionError("GitHub installation token response did not include a token.");
    }

    return response.token;
  }

  private async request<T = unknown>(input: {
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
      throw new GitHubPushPullRequestResolutionError(
        `GitHub push PR resolution request failed with status ${response.status}.${detail}`,
        response.status,
        githubMessage
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

function normalizeAssociatedPullRequest(value: unknown): GitHubAssociatedPullRequest | null {
  if (!isObject(value)) {
    return null;
  }

  const user = objectValue(value, "user");
  const base = objectValue(value, "base");
  const head = objectValue(value, "head");
  const id = numberValue(value, "id");
  const number = numberValue(value, "number");
  const title = stringValue(value, "title");
  const state = stringValue(value, "state");
  const authorLogin = stringValue(user, "login") ?? "unknown";
  const baseRef = stringValue(base, "ref");
  const baseSha = stringValue(base, "sha");
  const headRef = stringValue(head, "ref");
  const headSha = stringValue(head, "sha");

  if (
    id === null ||
    number === null ||
    title === null ||
    state === null ||
    baseRef === null ||
    baseSha === null ||
    headRef === null ||
    headSha === null
  ) {
    return null;
  }

  return {
    githubPullRequestId: id,
    number,
    title,
    authorLogin,
    baseRef,
    baseSha,
    headRef,
    headSha,
    state,
    draft: booleanValue(value, "draft") ?? false
  };
}

function splitRepositoryFullName(value: string): [string, string] {
  const [owner, repo] = value.split("/");

  if (!owner || !repo) {
    throw new GitHubPushPullRequestResolutionError("Repository full name must be owner/name.");
  }

  return [encodeURIComponent(owner), encodeURIComponent(repo)];
}

function objectValue(source: unknown, key: string): JsonObject | null {
  if (!isObject(source)) {
    return null;
  }

  const value = source[key];
  return isObject(value) ? value : null;
}

function stringValue(source: unknown, key: string): string | null {
  if (!isObject(source)) {
    return null;
  }

  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(source: unknown, key: string): number | null {
  if (!isObject(source)) {
    return null;
  }

  const value = source[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function booleanValue(source: unknown, key: string): boolean | null {
  if (!isObject(source)) {
    return null;
  }

  const value = source[key];
  return typeof value === "boolean" ? value : null;
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readGitHubErrorMessage(response: Response): Promise<string | null> {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    const message = stringValue(parsed, "message");

    if (message !== null) {
      return boundedGitHubMessage(message);
    }
  } catch {
    // Fall back to bounded raw text below.
  }

  return boundedGitHubMessage(text);
}

function boundedGitHubMessage(value: string): string {
  return value.trim().slice(0, 500);
}
