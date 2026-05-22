import { createSign } from "crypto";
import {
  firmcodeAiActivityMarker,
  renderFirmcodeAiScanningActivity,
  type ApiRuntimeConfig,
  type FirmcodeAiScanningActivityInput,
  type GitHubAppConfig
} from "@firmcode/shared";

export const GITHUB_PR_ACTIVITY_PUBLISHER = Symbol("GITHUB_PR_ACTIVITY_PUBLISHER");

export interface PublishPullRequestScanningActivityInput extends FirmcodeAiScanningActivityInput {
  readonly installationId: number;
}

export interface GitHubPullRequestActivityPublisher {
  publishScanningActivity(input: PublishPullRequestScanningActivityInput): Promise<void>;
}

export class NoopGitHubPullRequestActivityPublisher implements GitHubPullRequestActivityPublisher {
  async publishScanningActivity(_input: PublishPullRequestScanningActivityInput): Promise<void> {
    return undefined;
  }
}

export class GitHubActivityPublishError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null
  ) {
    super(message);
    this.name = "GitHubActivityPublishError";
  }
}

interface GitHubIssueComment {
  readonly id?: unknown;
  readonly body?: unknown;
}

interface GitHubInstallationTokenResponse {
  readonly token?: unknown;
}

export class GitHubAppPullRequestActivityPublisher implements GitHubPullRequestActivityPublisher {
  constructor(private readonly github: GitHubAppConfig) {}

  static fromConfig(config: ApiRuntimeConfig): GitHubPullRequestActivityPublisher {
    if (config.github === null) {
      return new NoopGitHubPullRequestActivityPublisher();
    }

    return new GitHubAppPullRequestActivityPublisher(config.github);
  }

  async publishScanningActivity(input: PublishPullRequestScanningActivityInput): Promise<void> {
    const [owner, repo] = splitRepositoryFullName(input.repositoryFullName);
    const token = await this.createInstallationAccessToken(input.installationId);
    const body = renderFirmcodeAiScanningActivity(input);
    const comments = await this.request<GitHubIssueComment[]>({
      method: "GET",
      token,
      path: `/repos/${owner}/${repo}/issues/${input.pullRequestNumber}/comments?per_page=100`
    });
    const existing = comments.find((comment) => {
      return typeof comment.body === "string" && comment.body.includes(firmcodeAiActivityMarker("scanning"));
    });

    if (existing?.id !== undefined && typeof existing.id === "number") {
      await this.request({
        method: "PATCH",
        token,
        path: `/repos/${owner}/${repo}/issues/comments/${existing.id}`,
        body: { body }
      });
      return;
    }

    await this.request({
      method: "POST",
      token,
      path: `/repos/${owner}/${repo}/issues/${input.pullRequestNumber}/comments`,
      body: { body }
    });
  }

  private async createInstallationAccessToken(installationId: number): Promise<string> {
    const response = await this.request<GitHubInstallationTokenResponse>({
      method: "POST",
      jwt: createGitHubAppJwt(this.github),
      path: `/app/installations/${installationId}/access_tokens`
    });

    if (typeof response.token !== "string" || response.token.length === 0) {
      throw new GitHubActivityPublishError("GitHub installation token response did not include a token.");
    }

    return response.token;
  }

  private async request<T = unknown>(input: {
    readonly method: "GET" | "PATCH" | "POST";
    readonly path: string;
    readonly token?: string;
    readonly jwt?: string;
    readonly body?: unknown;
  }): Promise<T> {
    const response = await fetch(`https://api.github.com${input.path}`, {
      method: input.method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: input.token ? `Bearer ${input.token}` : `Bearer ${input.jwt ?? ""}`,
        "content-type": "application/json",
        "user-agent": "firmcodeai"
      },
      body: input.body === undefined ? undefined : JSON.stringify(input.body)
    });

    if (!response.ok) {
      throw new GitHubActivityPublishError(`GitHub activity publish request failed with status ${response.status}.`, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

export function createGitHubAppJwt(github: GitHubAppConfig, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlJson({
    iat: nowSeconds - 60,
    exp: nowSeconds + 540,
    iss: github.appId
  });
  const input = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(input).sign(github.privateKey, "base64url");
  return `${input}.${signature}`;
}

function splitRepositoryFullName(value: string): [string, string] {
  const [owner, repo] = value.split("/");

  if (!owner || !repo) {
    throw new GitHubActivityPublishError("Repository full name must be owner/name.");
  }

  return [encodeURIComponent(owner), encodeURIComponent(repo)];
}

function base64UrlJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
