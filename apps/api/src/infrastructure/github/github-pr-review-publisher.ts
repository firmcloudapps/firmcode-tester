import { createHash, randomUUID } from "crypto";
import { DEFAULT_REVIEW_LIMITS, type ApiRuntimeConfig, type GitHubAppConfig, type WorkerSeverity } from "@firmcode/shared";
import type { DatabaseExecutor } from "../database/migrations";
import { createGitHubAppJwt } from "./github-pr-activity-publisher";

export const GITHUB_PR_REVIEW_PUBLISHER = Symbol("GITHUB_PR_REVIEW_PUBLISHER");

export interface InlineReviewChangedLine {
  readonly path: string;
  readonly line: number;
}

export interface InlineReviewEvidence {
  readonly source: string;
  readonly path: string | null;
  readonly lineRange: {
    readonly startLine: number;
    readonly endLine: number;
  } | null;
  readonly excerpt: string;
}

export interface PublishPullRequestInlineReviewCommentInput {
  readonly findingId: string;
  readonly path: string;
  readonly line: number;
  readonly title: string;
  readonly body: string;
  readonly severity: WorkerSeverity;
  readonly confidence: number;
  readonly evidence: readonly InlineReviewEvidence[];
  readonly suggestedFix: string | null;
}

export interface PublishPullRequestInlineReviewInput {
  readonly installationId: number;
  readonly repositoryFullName: string;
  readonly pullRequestNumber: number;
  readonly reviewRunId: string;
  readonly headSha: string;
  readonly changedLines: readonly InlineReviewChangedLine[];
  readonly inlineComments: readonly PublishPullRequestInlineReviewCommentInput[];
  readonly maxInlineComments?: number;
}

export interface GitHubPullRequestReviewPublisher {
  publishInlineReview(input: PublishPullRequestInlineReviewInput): Promise<PublishPullRequestInlineReviewResult>;
}

export interface PublishPullRequestInlineReviewResult {
  readonly reviewId: number | null;
  readonly selectedCommentCount: number;
  readonly skippedCommentCount: number;
  readonly cappedCommentCount: number;
  readonly publishedComments: readonly PublishedInlineCommentRecord[];
}

export interface PublishedInlineCommentRecord {
  readonly reviewRunId: string;
  readonly findingId: string;
  readonly githubCommentId: number;
  readonly filePath: string;
  readonly line: number;
  readonly bodyHash: string;
}

export interface PublishedCommentStore {
  recordPublishedInlineComments(records: readonly PublishedInlineCommentRecord[]): Promise<void>;
}

export class NoopPublishedCommentStore implements PublishedCommentStore {
  async recordPublishedInlineComments(_records: readonly PublishedInlineCommentRecord[]): Promise<void> {
    return undefined;
  }
}

export class InMemoryPublishedCommentStore implements PublishedCommentStore {
  readonly inlineComments: PublishedInlineCommentRecord[] = [];

  async recordPublishedInlineComments(records: readonly PublishedInlineCommentRecord[]): Promise<void> {
    this.inlineComments.push(...records);
  }
}

export class PostgresPublishedCommentStore implements PublishedCommentStore {
  constructor(
    private readonly database: DatabaseExecutor,
    private readonly createId: () => string = randomUUID
  ) {}

  async recordPublishedInlineComments(records: readonly PublishedInlineCommentRecord[]): Promise<void> {
    for (const record of records) {
      await this.database.query(
        `
INSERT INTO published_comments (
  id,
  review_run_id,
  finding_id,
  github_comment_id,
  comment_type,
  file_path,
  line,
  body_hash
) VALUES ($1, $2, $3, $4, 'inline', $5, $6, $7)
ON CONFLICT (review_run_id, comment_type, body_hash) DO UPDATE
SET github_comment_id = EXCLUDED.github_comment_id,
    finding_id = COALESCE(EXCLUDED.finding_id, published_comments.finding_id),
    file_path = EXCLUDED.file_path,
    line = EXCLUDED.line
`,
        [
          this.createId(),
          record.reviewRunId,
          isUuid(record.findingId) ? record.findingId : null,
          record.githubCommentId,
          record.filePath,
          record.line,
          record.bodyHash
        ]
      );
    }
  }
}

export class NoopGitHubPullRequestReviewPublisher implements GitHubPullRequestReviewPublisher {
  async publishInlineReview(input: PublishPullRequestInlineReviewInput): Promise<PublishPullRequestInlineReviewResult> {
    const build = buildGitHubInlineReviewPayload(input);
    return {
      reviewId: null,
      selectedCommentCount: build.selectedComments.length,
      skippedCommentCount: build.skippedCommentCount,
      cappedCommentCount: build.cappedCommentCount,
      publishedComments: []
    };
  }
}

export class GitHubReviewPublishError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly githubMessage: string | null = null
  ) {
    super(message);
    this.name = "GitHubReviewPublishError";
  }
}

interface GitHubInstallationTokenResponse {
  readonly token?: unknown;
}

interface GitHubReviewResponse {
  readonly id?: unknown;
}

interface GitHubReviewCommentResponse {
  readonly id?: unknown;
  readonly path?: unknown;
  readonly line?: unknown;
  readonly body?: unknown;
}

export interface GitHubInlineReviewCommentPayload {
  readonly path: string;
  readonly line: number;
  readonly side: "RIGHT";
  readonly body: string;
}

export interface GitHubInlineReviewPayload {
  readonly commit_id: string;
  readonly event: "COMMENT";
  readonly body: string;
  readonly comments: readonly GitHubInlineReviewCommentPayload[];
}

export interface SelectedInlineReviewComment {
  readonly findingId: string;
  readonly path: string;
  readonly line: number;
  readonly body: string;
  readonly severity: WorkerSeverity;
  readonly confidence: number;
}

export interface GitHubInlineReviewPayloadBuildResult {
  readonly payload: GitHubInlineReviewPayload | null;
  readonly selectedComments: readonly SelectedInlineReviewComment[];
  readonly skippedCommentCount: number;
  readonly cappedCommentCount: number;
}

const SEVERITY_RANK: Record<WorkerSeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export class GitHubAppPullRequestReviewPublisher implements GitHubPullRequestReviewPublisher {
  constructor(
    private readonly github: GitHubAppConfig,
    private readonly publishedCommentStore: PublishedCommentStore = new NoopPublishedCommentStore()
  ) {}

  static fromConfig(
    config: ApiRuntimeConfig,
    publishedCommentStore: PublishedCommentStore = new NoopPublishedCommentStore()
  ): GitHubPullRequestReviewPublisher {
    if (config.github === null) {
      return new NoopGitHubPullRequestReviewPublisher();
    }

    return new GitHubAppPullRequestReviewPublisher(config.github, publishedCommentStore);
  }

  async publishInlineReview(input: PublishPullRequestInlineReviewInput): Promise<PublishPullRequestInlineReviewResult> {
    const build = buildGitHubInlineReviewPayload(input);

    if (build.payload === null) {
      return {
        reviewId: null,
        selectedCommentCount: 0,
        skippedCommentCount: build.skippedCommentCount,
        cappedCommentCount: build.cappedCommentCount,
        publishedComments: []
      };
    }

    const [owner, repo] = splitRepositoryFullName(input.repositoryFullName);
    const token = await this.createInstallationAccessToken(input.installationId);
    const review = await this.request<GitHubReviewResponse>({
      method: "POST",
      token,
      path: `/repos/${owner}/${repo}/pulls/${input.pullRequestNumber}/reviews`,
      body: build.payload
    });

    if (typeof review.id !== "number") {
      throw new GitHubReviewPublishError("GitHub create review response did not include a review id.");
    }

    const reviewComments = await this.request<GitHubReviewCommentResponse[]>({
      method: "GET",
      token,
      path: `/repos/${owner}/${repo}/pulls/${input.pullRequestNumber}/reviews/${review.id}/comments?per_page=100`
    });
    const publishedComments = matchPublishedComments(input.reviewRunId, build.selectedComments, reviewComments);

    await this.publishedCommentStore.recordPublishedInlineComments(publishedComments);

    return {
      reviewId: review.id,
      selectedCommentCount: build.selectedComments.length,
      skippedCommentCount: build.skippedCommentCount,
      cappedCommentCount: build.cappedCommentCount,
      publishedComments
    };
  }

  private async createInstallationAccessToken(installationId: number): Promise<string> {
    const response = await this.request<GitHubInstallationTokenResponse>({
      method: "POST",
      jwt: createGitHubAppJwt(this.github),
      path: `/app/installations/${installationId}/access_tokens`
    });

    if (typeof response.token !== "string" || response.token.length === 0) {
      throw new GitHubReviewPublishError("GitHub installation token response did not include a token.");
    }

    return response.token;
  }

  private async request<T = unknown>(input: {
    readonly method: "GET" | "POST";
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
      throw new GitHubReviewPublishError(
        `GitHub review publish request failed with status ${response.status}.${detail}`,
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

export function buildGitHubInlineReviewPayload(
  input: PublishPullRequestInlineReviewInput
): GitHubInlineReviewPayloadBuildResult {
  const changedLinesByPath = buildChangedLineIndex(input.changedLines);
  const candidates = input.inlineComments
    .map((comment, index) => ({ comment, index }))
    .filter(({ comment }) => canPublishInline(comment, changedLinesByPath));
  const maxInlineComments = normalizeMaxInlineComments(input.maxInlineComments ?? DEFAULT_REVIEW_LIMITS.maxInlineComments);
  const sortedCandidates = [...candidates].sort(compareInlineCommentCandidates);
  const selected = sortedCandidates.slice(0, maxInlineComments);
  const selectedComments = selected.map(({ comment }) => {
    const body = renderInlineReviewComment(comment);
    return {
      findingId: comment.findingId,
      path: comment.path,
      line: comment.line,
      body,
      severity: comment.severity,
      confidence: normalizeConfidence(comment.confidence)
    };
  });

  if (selectedComments.length === 0) {
    return {
      payload: null,
      selectedComments,
      skippedCommentCount: input.inlineComments.length - candidates.length,
      cappedCommentCount: candidates.length
    };
  }

  return {
    payload: {
      commit_id: input.headSha,
      event: "COMMENT",
      body: `FirmcodeAI inline review for review run \`${input.reviewRunId}\`.`,
      comments: selectedComments.map((comment) => ({
        path: comment.path,
        line: comment.line,
        side: "RIGHT",
        body: comment.body
      }))
    },
    selectedComments,
    skippedCommentCount: input.inlineComments.length - candidates.length,
    cappedCommentCount: Math.max(0, candidates.length - selectedComments.length)
  };
}

export function renderInlineReviewComment(comment: PublishPullRequestInlineReviewCommentInput): string {
  return [
    `### ${comment.title.trim()}`,
    "",
    `**Severity:** ${comment.severity.toUpperCase()}`,
    `**Confidence:** ${Math.round(normalizeConfidence(comment.confidence) * 100)}%`,
    "",
    comment.body.trim(),
    "",
    "**Evidence:**",
    ...comment.evidence.map(renderEvidence),
    "",
    "**Actionable fix:**",
    comment.suggestedFix?.trim() ?? ""
  ].join("\n");
}

function buildChangedLineIndex(changedLines: readonly InlineReviewChangedLine[]): Map<string, Set<number>> {
  const changedLinesByPath = new Map<string, Set<number>>();

  for (const changedLine of changedLines) {
    if (!changedLine.path.trim() || !Number.isInteger(changedLine.line) || changedLine.line <= 0) {
      continue;
    }

    const lines = changedLinesByPath.get(changedLine.path) ?? new Set<number>();
    lines.add(changedLine.line);
    changedLinesByPath.set(changedLine.path, lines);
  }

  return changedLinesByPath;
}

function canPublishInline(
  comment: PublishPullRequestInlineReviewCommentInput,
  changedLinesByPath: ReadonlyMap<string, ReadonlySet<number>>
): boolean {
  const changedLines = changedLinesByPath.get(comment.path);
  const hasActionableFix = Boolean(comment.suggestedFix?.trim());
  const hasEvidence = comment.evidence.some((evidence) => evidence.excerpt.trim().length > 0);

  return Boolean(
    comment.findingId.trim() &&
      comment.path.trim() &&
      Number.isInteger(comment.line) &&
      comment.line > 0 &&
      comment.title.trim() &&
      comment.body.trim() &&
      hasActionableFix &&
      hasEvidence &&
      changedLines?.has(comment.line)
  );
}

function compareInlineCommentCandidates(
  left: { readonly comment: PublishPullRequestInlineReviewCommentInput; readonly index: number },
  right: { readonly comment: PublishPullRequestInlineReviewCommentInput; readonly index: number }
): number {
  const severityDelta = SEVERITY_RANK[right.comment.severity] - SEVERITY_RANK[left.comment.severity];
  if (severityDelta !== 0) {
    return severityDelta;
  }

  const confidenceDelta = normalizeConfidence(right.comment.confidence) - normalizeConfidence(left.comment.confidence);
  if (confidenceDelta !== 0) {
    return confidenceDelta;
  }

  return left.index - right.index;
}

function renderEvidence(evidence: InlineReviewEvidence): string {
  const location = renderEvidenceLocation(evidence);
  return `- ${evidence.source}${location}: ${boundedText(evidence.excerpt, 500)}`;
}

function renderEvidenceLocation(evidence: InlineReviewEvidence): string {
  if (!evidence.path) {
    return "";
  }

  if (evidence.lineRange === null) {
    return ` \`${evidence.path}\``;
  }

  const line =
    evidence.lineRange.startLine === evidence.lineRange.endLine
      ? String(evidence.lineRange.startLine)
      : `${evidence.lineRange.startLine}-${evidence.lineRange.endLine}`;

  return ` \`${evidence.path}:${line}\``;
}

function matchPublishedComments(
  reviewRunId: string,
  selectedComments: readonly SelectedInlineReviewComment[],
  reviewComments: readonly GitHubReviewCommentResponse[]
): PublishedInlineCommentRecord[] {
  const remaining = [...reviewComments];

  return selectedComments.map((selectedComment) => {
    const matchIndex = remaining.findIndex((comment) => {
      return (
        comment.body === selectedComment.body &&
        comment.path === selectedComment.path &&
        comment.line === selectedComment.line &&
        typeof comment.id === "number"
      );
    });
    const matched = matchIndex >= 0 ? remaining.splice(matchIndex, 1)[0] : undefined;

    if (matched === undefined || typeof matched.id !== "number") {
      throw new GitHubReviewPublishError("GitHub review comments response did not include every published inline comment id.");
    }

    return {
      reviewRunId,
      findingId: selectedComment.findingId,
      githubCommentId: matched.id,
      filePath: selectedComment.path,
      line: selectedComment.line,
      bodyHash: hashPublishedInlineComment(selectedComment)
    };
  });
}

function hashPublishedInlineComment(comment: SelectedInlineReviewComment): string {
  return createHash("sha256")
    .update(comment.findingId)
    .update("\0")
    .update(comment.path)
    .update("\0")
    .update(String(comment.line))
    .update("\0")
    .update(comment.body)
    .digest("hex");
}

function splitRepositoryFullName(value: string): [string, string] {
  const [owner, repo] = value.split("/");

  if (!owner || !repo) {
    throw new GitHubReviewPublishError("Repository full name must be owner/name.");
  }

  return [encodeURIComponent(owner), encodeURIComponent(repo)];
}

function normalizeMaxInlineComments(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_REVIEW_LIMITS.maxInlineComments;
  }

  return Math.max(0, Math.floor(value));
}

function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function boundedText(value: string, maxLength: number): string {
  const normalized = value.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}...`;
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
        return boundedText(message, 500);
      }
    }
  } catch {
    // Fall back to bounded raw text below.
  }

  return boundedText(text, 500);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
