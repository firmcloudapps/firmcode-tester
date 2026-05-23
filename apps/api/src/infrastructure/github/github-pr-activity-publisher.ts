import { createSign } from "crypto";
import {
  firmcodeAiActivityMarker,
  renderFirmcodeAiSummaryActivity,
  type ApiRuntimeConfig,
  type FirmcodeAiSummaryActivityInput,
  type GitHubAppConfig
} from "@firmcode/shared";
import {
  hashPublishedCommentBody,
  NoopPublishedCommentStore,
  type PublishedCommentStore
} from "./published-comment-store";

export const GITHUB_PR_ACTIVITY_PUBLISHER = Symbol("GITHUB_PR_ACTIVITY_PUBLISHER");

export interface PublishPullRequestSummaryActivityInput extends FirmcodeAiSummaryActivityInput {
  readonly installationId: number;
}

export interface PublishPullRequestActivityResult {
  readonly action: "created" | "updated" | "dry_run";
  readonly githubCommentId: number | null;
  readonly body: string;
}

export interface GitHubPullRequestActivityPublisher {
  publishSummaryActivity(input: PublishPullRequestSummaryActivityInput): Promise<PublishPullRequestActivityResult>;
}

export class NoopGitHubPullRequestActivityPublisher implements GitHubPullRequestActivityPublisher {
  async publishSummaryActivity(input: PublishPullRequestSummaryActivityInput): Promise<PublishPullRequestActivityResult> {
    return {
      action: "created",
      githubCommentId: 0,
      body: renderFirmcodeAiSummaryActivity(input)
    };
  }
}

export class DryRunGitHubPullRequestActivityPublisher implements GitHubPullRequestActivityPublisher {
  constructor(private readonly publishedCommentStore: PublishedCommentStore = new NoopPublishedCommentStore()) {}

  async publishSummaryActivity(input: PublishPullRequestSummaryActivityInput): Promise<PublishPullRequestActivityResult> {
    const body = renderFirmcodeAiSummaryActivity(input);

    await this.publishedCommentStore.recordPublishedSummaryComment({
      reviewRunId: input.reviewRunId,
      githubCommentId: null,
      body,
      bodyHash: hashPublishedCommentBody({ reviewRunId: input.reviewRunId, body }),
      dryRun: true
    });

    console.info(
      JSON.stringify({
        event: "github.activity.dry_run",
        activity: "summary",
        repositoryFullName: input.repositoryFullName,
        pullRequestNumber: input.pullRequestNumber,
        reviewRunId: input.reviewRunId,
        githubWriteCallsSkipped: true
      })
    );

    return {
      action: "dry_run",
      githubCommentId: null,
      body
    };
  }
}

export class GitHubActivityPublishError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly githubMessage: string | null = null
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

  static fromConfig(
    config: ApiRuntimeConfig,
    publishedCommentStore: PublishedCommentStore = new NoopPublishedCommentStore()
  ): GitHubPullRequestActivityPublisher {
    if (config.review.dryRun) {
      return new DryRunGitHubPullRequestActivityPublisher(publishedCommentStore);
    }

    if (config.github === null) {
      return new NoopGitHubPullRequestActivityPublisher();
    }

    return new GitHubAppPullRequestActivityPublisher(config.github);
  }

  async publishSummaryActivity(input: PublishPullRequestSummaryActivityInput): Promise<PublishPullRequestActivityResult> {
    return this.publishIssueCommentActivity({
      installationId: input.installationId,
      repositoryFullName: input.repositoryFullName,
      pullRequestNumber: input.pullRequestNumber,
      marker: firmcodeAiActivityMarker("summary"),
      body: renderFirmcodeAiSummaryActivity(input)
    });
  }

  private async publishIssueCommentActivity(input: {
    readonly installationId: number;
    readonly repositoryFullName: string;
    readonly pullRequestNumber: number;
    readonly marker: string;
    readonly body: string;
  }): Promise<PublishPullRequestActivityResult> {
    const [owner, repo] = splitRepositoryFullName(input.repositoryFullName);
    const token = await this.createInstallationAccessToken(input.installationId);
    const comments = await this.request<GitHubIssueComment[]>({
      method: "GET",
      token,
      path: `/repos/${owner}/${repo}/issues/${input.pullRequestNumber}/comments?per_page=100`
    });
    const existing = comments.find((comment) => {
      return typeof comment.body === "string" && comment.body.includes(input.marker);
    });

    if (existing?.id !== undefined && typeof existing.id === "number") {
      await this.request({
        method: "PATCH",
        token,
        path: `/repos/${owner}/${repo}/issues/comments/${existing.id}`,
        body: { body: input.body }
      });
      return {
        action: "updated",
        githubCommentId: existing.id,
        body: input.body
      };
    }

    const created = await this.request<GitHubIssueComment>({
      method: "POST",
      token,
      path: `/repos/${owner}/${repo}/issues/${input.pullRequestNumber}/comments`,
      body: { body: input.body }
    });

    if (typeof created.id !== "number") {
      throw new GitHubActivityPublishError("GitHub create comment response did not include a comment id.");
    }

    return {
      action: "created",
      githubCommentId: created.id,
      body: input.body
    };
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
      const githubMessage = await readGitHubErrorMessage(response);
      const detail = githubMessage === null ? "" : ` GitHub message: ${githubMessage}`;
      throw new GitHubActivityPublishError(
        `GitHub activity publish request failed with status ${response.status}.${detail}`,
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

async function readGitHubErrorMessage(response: Response): Promise<string | null> {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(text);

    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      const message = (parsed as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        return boundedGitHubMessage(message);
      }
    }
  } catch {
    // Fall back to bounded raw text below.
  }

  return boundedGitHubMessage(text);
}

function boundedGitHubMessage(value: string): string {
  return value.trim().slice(0, 500);
}
