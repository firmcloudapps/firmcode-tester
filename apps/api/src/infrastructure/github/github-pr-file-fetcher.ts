import {
  classifyChangedFileRisk,
  classifyLowValueFile,
  createLargePullRequestReviewArtifact,
  type ChangedFileRiskClassification,
  type LargePullRequestReviewArtifact,
  type LargePullRequestThresholds,
  type ReviewFileHandling
} from "@firmcode/shared";

export interface GitHubRestRequest {
  readonly method?: "GET";
  readonly path: string;
}

export interface GitHubRestClient {
  requestJson<T>(request: GitHubRestRequest): Promise<T>;
}

export interface GitHubPullRequestFilesInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
  readonly headSha: string;
}

export interface GitHubPullRequestFilesResult {
  readonly files: GitHubFetchedPullRequestFile[];
  readonly skippedFiles: GitHubSkippedPullRequestFile[];
  readonly largePullRequest: LargePullRequestReviewArtifact;
  readonly pageCount: number;
  readonly totalFiles: number;
}

export interface GitHubFetchedPullRequestFile {
  readonly path: string;
  readonly previousPath: string | null;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
  readonly patch: string;
  readonly language: SupportedGitHubFileLanguage;
  readonly headSha: string;
  readonly content: string;
  readonly sizeBytes: number;
  readonly risk: ChangedFileRiskClassification;
}

export interface GitHubSkippedPullRequestFile {
  readonly path: string;
  readonly previousPath: string | null;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
  readonly patch: string | null;
  readonly reason: GitHubSkippedPullRequestFileReason;
  readonly handling: Extract<ReviewFileHandling, "summarized" | "skipped">;
  readonly detail: string;
  readonly sizeBytes: number | null;
  readonly excludedFromSemgrep: boolean;
  readonly excludedFromTreeSitter: boolean;
  readonly excludedFromLlmContext: boolean;
  readonly risk: ChangedFileRiskClassification;
}

export type GitHubSkippedPullRequestFileReason =
  | "deleted"
  | "binary"
  | "dependency_lockfile"
  | "generated"
  | "large_snapshot"
  | "minified"
  | "unsupported"
  | "oversized"
  | "content_unavailable"
  | "vendor";

export type SupportedGitHubFileLanguage =
  | "dockerfile"
  | "go"
  | "hcl"
  | "java"
  | "javascript"
  | "json"
  | "python"
  | "terraform"
  | "typescript"
  | "yaml";

export interface GitHubPullRequestFileFetcherOptions {
  readonly perPage?: number;
  readonly maxContentBytes?: number;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
  readonly largePullRequestThresholds?: Partial<LargePullRequestThresholds>;
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

interface GitHubPullRequestFileResponse {
  readonly filename?: unknown;
  readonly previous_filename?: unknown;
  readonly status?: unknown;
  readonly additions?: unknown;
  readonly deletions?: unknown;
  readonly patch?: unknown;
  readonly size?: unknown;
}

interface GitHubContentsFileResponse {
  readonly type?: unknown;
  readonly encoding?: unknown;
  readonly content?: unknown;
  readonly size?: unknown;
}

const DEFAULT_PER_PAGE = 100;
const DEFAULT_MAX_CONTENT_BYTES = 500_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 25;
const DELETED_FILE_STATUSES = new Set(["removed", "deleted"]);
const BINARY_EXTENSIONS = new Set([
  ".7z",
  ".avif",
  ".bmp",
  ".class",
  ".dll",
  ".dmg",
  ".doc",
  ".docx",
  ".exe",
  ".gif",
  ".gz",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".mov",
  ".mp3",
  ".mp4",
  ".pdf",
  ".png",
  ".so",
  ".tar",
  ".webp",
  ".xls",
  ".xlsx",
  ".zip"
]);

const EXTENSION_LANGUAGE_MAP = new Map<string, SupportedGitHubFileLanguage>([
  [".cjs", "javascript"],
  [".go", "go"],
  [".hcl", "hcl"],
  [".java", "java"],
  [".js", "javascript"],
  [".json", "json"],
  [".jsx", "javascript"],
  [".mjs", "javascript"],
  [".py", "python"],
  [".tf", "terraform"],
  [".ts", "typescript"],
  [".tsx", "typescript"],
  [".yaml", "yaml"],
  [".yml", "yaml"]
]);

export class GitHubPullRequestFileFetcher {
  private readonly perPage: number;
  private readonly maxContentBytes: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly largePullRequestThresholds: Partial<LargePullRequestThresholds>;

  constructor(
    private readonly client: GitHubRestClient,
    options: GitHubPullRequestFileFetcherOptions = {}
  ) {
    this.perPage = options.perPage ?? DEFAULT_PER_PAGE;
    this.maxContentBytes = options.maxContentBytes ?? DEFAULT_MAX_CONTENT_BYTES;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.largePullRequestThresholds = options.largePullRequestThresholds ?? {};
  }

  async fetchPullRequestFiles(input: GitHubPullRequestFilesInput): Promise<GitHubPullRequestFilesResult> {
    const files = await this.fetchPaginatedFiles(input);
    const fetchedFiles: GitHubFetchedPullRequestFile[] = [];
    const skippedFiles: GitHubSkippedPullRequestFile[] = [];
    const changedFilesForArtifact: NormalizedGitHubPullRequestFile[] = [];

    for (const file of files.items) {
      const normalized = normalizePullRequestFile(file);
      changedFilesForArtifact.push(normalized);
      const preContentSkip = this.classifyPreContentSkip(normalized);

      if (preContentSkip !== null) {
        skippedFiles.push(toSkippedPullRequestFile(normalized, preContentSkip.reason, normalized.sizeBytes, preContentSkip));
        continue;
      }

      const content = await this.fetchFileContent(input, normalized.path);
      const contentSkip = classifyContentSkip(content, this.maxContentBytes);

      if (contentSkip !== null) {
        skippedFiles.push(toSkippedPullRequestFile(normalized, contentSkip.reason, contentSkip.sizeBytes));
        continue;
      }

      const language = resolveSupportedLanguage(normalized.path);

      if (language === null) {
        skippedFiles.push(toSkippedPullRequestFile(normalized, "unsupported", content.sizeBytes));
        continue;
      }

      fetchedFiles.push({
        path: normalized.path,
        previousPath: normalized.previousPath,
        status: normalized.status,
        additions: normalized.additions,
        deletions: normalized.deletions,
        patch: normalized.patch ?? "",
        language,
        headSha: input.headSha,
        content: content.text,
        sizeBytes: content.sizeBytes ?? Buffer.byteLength(content.text, "utf8"),
        risk: classifyChangedFileRisk({
          path: normalized.path,
          previousPath: normalized.previousPath,
          patch: normalized.patch,
          content: content.text
        })
      });
    }

    return {
      files: fetchedFiles,
      skippedFiles,
      largePullRequest: createLargePullRequestReviewArtifact({
        files: changedFilesForArtifact.map(toReviewPlanChangedFile),
        thresholds: this.largePullRequestThresholds
      }),
      pageCount: files.pageCount,
      totalFiles: files.items.length
    };
  }

  private async fetchPaginatedFiles(input: GitHubPullRequestFilesInput): Promise<{
    items: GitHubPullRequestFileResponse[];
    pageCount: number;
  }> {
    const items: GitHubPullRequestFileResponse[] = [];
    let page = 1;
    let pageCount = 0;

    while (true) {
      const pageItems = await this.requestWithRetry<GitHubPullRequestFileResponse[]>({
        path: `/repos/${encodePathPart(input.owner)}/${encodePathPart(input.repo)}/pulls/${input.pullNumber}/files?per_page=${this.perPage}&page=${page}`
      });

      pageCount += 1;
      items.push(...pageItems);

      if (pageItems.length < this.perPage) {
        break;
      }

      page += 1;
    }

    return { items, pageCount };
  }

  private classifyPreContentSkip(file: NormalizedGitHubPullRequestFile): GitHubPreContentSkip | null {
    if (DELETED_FILE_STATUSES.has(file.status)) {
      return {
        reason: "deleted",
        handling: "skipped",
        detail: "deleted files are not available on the pull request head",
        excludedFromSemgrep: true
      };
    }

    if (isBinaryPath(file.path)) {
      return {
        reason: "binary",
        handling: "skipped",
        detail: "binary files are excluded from static analysis and LLM context",
        excludedFromSemgrep: true
      };
    }

    const lowValueSkip = classifyLowValueFile(toReviewPlanChangedFile(file));

    if (lowValueSkip !== null) {
      return lowValueSkip;
    }

    if (file.sizeBytes !== null && file.sizeBytes > this.maxContentBytes) {
      return {
        reason: "oversized",
        handling: "skipped",
        detail: "file exceeds the configured content fetch size limit",
        excludedFromSemgrep: true
      };
    }

    if (resolveSupportedLanguage(file.path) === null) {
      return {
        reason: "unsupported",
        handling: "skipped",
        detail: "file language is not supported by the MVP analysis pipeline",
        excludedFromSemgrep: true
      };
    }

    return null;
  }

  private async fetchFileContent(
    input: GitHubPullRequestFilesInput,
    path: string
  ): Promise<DecodedGitHubFileContent> {
    const content = await this.requestWithRetry<GitHubContentsFileResponse | GitHubContentsFileResponse[]>({
      path: `/repos/${encodePathPart(input.owner)}/${encodePathPart(input.repo)}/contents/${encodeRepositoryPath(path)}?ref=${encodeURIComponent(input.headSha)}`
    });

    if (Array.isArray(content)) {
      return { available: false, text: "", sizeBytes: null, binary: false };
    }

    return decodeContentResponse(content);
  }

  private async requestWithRetry<T>(request: GitHubRestRequest): Promise<T> {
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt <= this.maxRetries) {
      try {
        return await this.client.requestJson<T>(request);
      } catch (error) {
        lastError = error;

        if (!isTransientGitHubFailure(error) || attempt === this.maxRetries) {
          throw error;
        }

        await delay(this.retryDelayMs * 2 ** attempt);
        attempt += 1;
      }
    }

    throw lastError;
  }
}

export class GitHubFetchRestClient implements GitHubRestClient {
  constructor(
    private readonly token: string,
    private readonly baseUrl = "https://api.github.com"
  ) {}

  async requestJson<T>(request: GitHubRestRequest): Promise<T> {
    const response = await fetch(`${this.baseUrl}${request.path}`, {
      method: request.method ?? "GET",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.token}`,
        "x-github-api-version": "2022-11-28"
      }
    });

    if (!response.ok) {
      throw new GitHubApiError(`GitHub request failed with status ${response.status}`, response.status);
    }

    return (await response.json()) as T;
  }
}

interface NormalizedGitHubPullRequestFile {
  readonly path: string;
  readonly previousPath: string | null;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
  readonly patch: string | null;
  readonly sizeBytes: number | null;
}

interface GitHubPreContentSkip {
  readonly reason: GitHubSkippedPullRequestFileReason;
  readonly handling: Extract<ReviewFileHandling, "summarized" | "skipped">;
  readonly detail: string;
  readonly excludedFromSemgrep: boolean;
}

interface DecodedGitHubFileContent {
  readonly available: boolean;
  readonly text: string;
  readonly sizeBytes: number | null;
  readonly binary: boolean;
}

function normalizePullRequestFile(file: GitHubPullRequestFileResponse): NormalizedGitHubPullRequestFile {
  const path = readRequiredString(file.filename, "filename");

  return {
    path,
    previousPath: readOptionalString(file.previous_filename),
    status: readRequiredString(file.status, "status"),
    additions: readRequiredInteger(file.additions, "additions"),
    deletions: readRequiredInteger(file.deletions, "deletions"),
    patch: readOptionalString(file.patch),
    sizeBytes: readOptionalInteger(file.size)
  };
}

function toSkippedPullRequestFile(
  file: NormalizedGitHubPullRequestFile,
  reason: GitHubSkippedPullRequestFileReason,
  sizeBytes: number | null,
  skip: GitHubPreContentSkip = defaultPreContentSkip(reason)
): GitHubSkippedPullRequestFile {
  return {
    path: file.path,
    previousPath: file.previousPath,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch,
    reason,
    handling: skip.handling,
    detail: skip.detail,
    sizeBytes,
    excludedFromSemgrep: skip.excludedFromSemgrep,
    excludedFromTreeSitter: true,
    excludedFromLlmContext: true,
    risk: classifyChangedFileRisk({
      path: file.path,
      previousPath: file.previousPath,
      patch: file.patch
    })
  };
}

function defaultPreContentSkip(reason: GitHubSkippedPullRequestFileReason): GitHubPreContentSkip {
  return {
    reason,
    handling: "skipped",
    detail: defaultSkipDetail(reason),
    excludedFromSemgrep: true
  };
}

function defaultSkipDetail(reason: GitHubSkippedPullRequestFileReason): string {
  switch (reason) {
    case "binary":
      return "binary files are excluded from static analysis and LLM context";
    case "content_unavailable":
      return "GitHub did not return a readable file blob";
    case "deleted":
      return "deleted files are not available on the pull request head";
    case "oversized":
      return "file exceeds the configured content fetch size limit";
    case "unsupported":
      return "file language is not supported by the MVP analysis pipeline";
    case "dependency_lockfile":
      return "dependency lockfiles are summarized and risk-flagged instead of fully packed";
    case "generated":
      return "generated files are summarized and kept eligible for deterministic secret scanning";
    case "large_snapshot":
      return "snapshot or golden files are summarized because review value is low";
    case "minified":
      return "minified assets are summarized because line-level review signal is low";
    case "vendor":
      return "vendor or build-output paths are summarized instead of sent as review context";
  }
}

function toReviewPlanChangedFile(file: NormalizedGitHubPullRequestFile) {
  return {
    path: file.path,
    previousPath: file.previousPath,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch,
    sizeBytes: file.sizeBytes,
    risk: classifyChangedFileRisk({
      path: file.path,
      previousPath: file.previousPath,
      patch: file.patch
    }),
    binary: isBinaryPath(file.path)
  };
}

function decodeContentResponse(content: GitHubContentsFileResponse): DecodedGitHubFileContent {
  if (content.type !== "file" || content.encoding !== "base64" || typeof content.content !== "string") {
    return { available: false, text: "", sizeBytes: readOptionalInteger(content.size), binary: false };
  }

  const buffer = Buffer.from(content.content.replace(/\s/g, ""), "base64");
  const sizeBytes = readOptionalInteger(content.size) ?? buffer.byteLength;
  const text = buffer.toString("utf8");

  return {
    available: true,
    text,
    sizeBytes,
    binary: isBinaryBuffer(buffer, text)
  };
}

function classifyContentSkip(
  content: DecodedGitHubFileContent,
  maxContentBytes: number
): { reason: GitHubSkippedPullRequestFileReason; sizeBytes: number | null } | null {
  if (!content.available) {
    return { reason: "content_unavailable", sizeBytes: content.sizeBytes };
  }

  if (content.sizeBytes !== null && content.sizeBytes > maxContentBytes) {
    return { reason: "oversized", sizeBytes: content.sizeBytes };
  }

  if (content.binary) {
    return { reason: "binary", sizeBytes: content.sizeBytes };
  }

  return null;
}

function resolveSupportedLanguage(path: string): SupportedGitHubFileLanguage | null {
  const basename = path.split("/").at(-1)?.toLowerCase() ?? "";

  if (basename === "dockerfile" || basename.endsWith(".dockerfile")) {
    return "dockerfile";
  }

  const extension = readExtension(basename);
  return extension === null ? null : EXTENSION_LANGUAGE_MAP.get(extension) ?? null;
}

function isBinaryPath(path: string): boolean {
  const extension = readExtension(path.toLowerCase());
  return extension !== null && BINARY_EXTENSIONS.has(extension);
}

function isBinaryBuffer(buffer: Buffer, text: string): boolean {
  if (buffer.includes(0)) {
    return true;
  }

  return text.includes("\uFFFD");
}

function readExtension(path: string): string | null {
  const basename = path.split("/").at(-1) ?? path;
  const dotIndex = basename.lastIndexOf(".");

  if (dotIndex <= 0) {
    return null;
  }

  return basename.slice(dotIndex);
}

function isTransientGitHubFailure(error: unknown): boolean {
  const status = readErrorStatus(error);

  if (status === null) {
    return error instanceof Error;
  }

  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function readErrorStatus(error: unknown): number | null {
  if (error instanceof GitHubApiError) {
    return error.status;
  }

  if (error !== null && typeof error === "object") {
    const status = "status" in error ? error.status : "statusCode" in error ? error.statusCode : null;

    if (typeof status === "number" && Number.isInteger(status)) {
      return status;
    }
  }

  return null;
}

function readRequiredString(value: unknown, key: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new Error(`GitHub PR file response is missing ${key}`);
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readRequiredInteger(value: unknown, key: string): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  throw new Error(`GitHub PR file response is missing ${key}`);
}

function readOptionalInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value);
}

function encodeRepositoryPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}
