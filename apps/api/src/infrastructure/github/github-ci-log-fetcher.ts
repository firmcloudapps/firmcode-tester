import {
  DEFAULT_CI_LOG_MAX_BYTES,
  WORKER_CI_LOG_ARTIFACT_SCHEMA_VERSION,
  type WorkerCiCheckRun,
  type WorkerCiLogArtifact,
  type WorkerCiLogEntry,
  type WorkerCiLogUnavailableReason,
  type WorkerUnavailableCiLog
} from "@firmcode/shared";
import { GitHubApiError, type GitHubRestRequest } from "./github-pr-file-fetcher";

export interface GitHubCiLogRestClient {
  requestJson<T>(request: GitHubRestRequest): Promise<T>;
  requestText(request: GitHubRestRequest): Promise<string>;
}

export interface GitHubPullRequestCiLogInput {
  readonly reviewRunId: string;
  readonly owner: string;
  readonly repo: string;
  readonly pullRequestNumber: number;
  readonly headSha: string;
}

export interface GitHubPullRequestCiLogFetcherOptions {
  readonly perPage?: number;
  readonly maxLogBytes?: number;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
}

export interface SanitizedCiLogContent {
  readonly content: string;
  readonly originalBytes: number;
  readonly redactedBytes: number;
  readonly storedBytes: number;
  readonly redacted: boolean;
  readonly truncated: boolean;
}

interface GitHubCheckRunsResponse {
  readonly check_runs?: unknown;
}

interface GitHubCheckRunResponse {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly status?: unknown;
  readonly conclusion?: unknown;
  readonly details_url?: unknown;
  readonly html_url?: unknown;
  readonly started_at?: unknown;
  readonly completed_at?: unknown;
  readonly app?: unknown;
}

interface GitHubWorkflowJobsResponse {
  readonly jobs?: unknown;
}

interface GitHubWorkflowJobResponse {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly status?: unknown;
  readonly conclusion?: unknown;
  readonly check_run_url?: unknown;
}

interface GitHubActionsIds {
  readonly workflowRunId: number | null;
  readonly workflowJobId: number | null;
}

const DEFAULT_PER_PAGE = 100;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 25;
const FAILED_CHECK_CONCLUSIONS = new Set(["action_required", "cancelled", "failure", "startup_failure", "stale", "timed_out"]);
const REDACTED_SECRET = "[REDACTED_SECRET]";
const TRUNCATION_MARKER_PREFIX = "...[Firmcode truncated CI log:";

export class GitHubPullRequestCiLogFetcher {
  private readonly perPage: number;
  private readonly maxLogBytes: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(
    private readonly client: GitHubCiLogRestClient,
    options: GitHubPullRequestCiLogFetcherOptions = {}
  ) {
    this.perPage = options.perPage ?? DEFAULT_PER_PAGE;
    this.maxLogBytes = options.maxLogBytes ?? DEFAULT_CI_LOG_MAX_BYTES;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  }

  async fetchFailedCiLogs(input: GitHubPullRequestCiLogInput): Promise<WorkerCiLogArtifact> {
    const checkRuns = await this.fetchFailedCheckRuns(input).catch((error: unknown) => {
      const reason = mapCheckRunListFailure(error);

      if (reason === null) {
        throw error;
      }

      return {
        checkRuns: [],
        unavailableLogs: [
          {
            checkRunId: null,
            name: null,
            reason,
            detail: renderGitHubFailureDetail(error, "listing check runs")
          }
        ]
      };
    });
    const logs: WorkerCiLogEntry[] = [];
    const unavailableLogs: WorkerUnavailableCiLog[] = [...checkRuns.unavailableLogs];

    for (const checkRun of checkRuns.checkRuns) {
      if (!isGitHubActionsCheckRun(checkRun)) {
        unavailableLogs.push(toUnavailableLog(checkRun, "not_github_actions", "Check run was not produced by GitHub Actions."));
        continue;
      }

      let workflowJobId: number | null;

      try {
        workflowJobId = checkRun.workflowJobId ?? (await this.resolveWorkflowJobId(input, checkRun));
      } catch (error) {
        unavailableLogs.push(
          toUnavailableLog(checkRun, mapLogFetchFailure(error), renderGitHubFailureDetail(error, "listing Actions workflow jobs"))
        );
        continue;
      }

      if (workflowJobId === null) {
        unavailableLogs.push(
          toUnavailableLog(checkRun, "workflow_job_unavailable", "Could not resolve a GitHub Actions job for this check run.")
        );
        continue;
      }

      const log = await this.fetchSanitizedJobLog(input, checkRun, workflowJobId);

      if ("reason" in log) {
        unavailableLogs.push(log);
      } else {
        logs.push(log);
      }
    }

    return {
      schemaVersion: WORKER_CI_LOG_ARTIFACT_SCHEMA_VERSION,
      reviewRunId: input.reviewRunId,
      repositoryFullName: `${input.owner}/${input.repo}`,
      pullRequestNumber: input.pullRequestNumber,
      headSha: input.headSha,
      checkRuns: checkRuns.checkRuns,
      logs,
      unavailableLogs
    };
  }

  private async fetchFailedCheckRuns(input: GitHubPullRequestCiLogInput): Promise<{
    checkRuns: WorkerCiCheckRun[];
    unavailableLogs: WorkerUnavailableCiLog[];
  }> {
    const checkRuns: WorkerCiCheckRun[] = [];
    let page = 1;

    while (true) {
      const response = await this.requestJsonWithRetry<GitHubCheckRunsResponse>({
        path: `/repos/${encodePathPart(input.owner)}/${encodePathPart(input.repo)}/commits/${encodeURIComponent(
          input.headSha
        )}/check-runs?per_page=${this.perPage}&page=${page}`
      });
      const pageItems = readCheckRuns(response);

      checkRuns.push(...pageItems.map(normalizeCheckRun).filter(isFailedCheckRun));

      if (pageItems.length < this.perPage) {
        break;
      }

      page += 1;
    }

    return { checkRuns, unavailableLogs: [] };
  }

  private async resolveWorkflowJobId(
    input: GitHubPullRequestCiLogInput,
    checkRun: WorkerCiCheckRun
  ): Promise<number | null> {
    if (checkRun.workflowRunId === null) {
      return null;
    }

    const jobs = await this.fetchWorkflowJobs(input, checkRun.workflowRunId);
    const matched = jobs.find((job) => {
      const checkRunUrl = readOptionalString(job.check_run_url);
      const jobName = readOptionalString(job.name);

      return checkRunUrl?.endsWith(`/check-runs/${checkRun.id}`) === true || jobName === checkRun.name;
    });

    return readOptionalPositiveInteger(matched?.id);
  }

  private async fetchWorkflowJobs(
    input: GitHubPullRequestCiLogInput,
    workflowRunId: number
  ): Promise<GitHubWorkflowJobResponse[]> {
    const jobs: GitHubWorkflowJobResponse[] = [];
    let page = 1;

    while (true) {
      const response = await this.requestJsonWithRetry<GitHubWorkflowJobsResponse>({
        path: `/repos/${encodePathPart(input.owner)}/${encodePathPart(input.repo)}/actions/runs/${workflowRunId}/jobs?per_page=${this.perPage}&page=${page}`
      });
      const pageItems = readWorkflowJobs(response);

      jobs.push(...pageItems);

      if (pageItems.length < this.perPage) {
        break;
      }

      page += 1;
    }

    return jobs;
  }

  private async fetchSanitizedJobLog(
    input: GitHubPullRequestCiLogInput,
    checkRun: WorkerCiCheckRun,
    workflowJobId: number
  ): Promise<WorkerCiLogEntry | WorkerUnavailableCiLog> {
    try {
      const rawLog = await this.requestTextWithRetry({
        path: `/repos/${encodePathPart(input.owner)}/${encodePathPart(input.repo)}/actions/jobs/${workflowJobId}/logs`
      });
      const sanitized = sanitizeCiLogContent(rawLog, this.maxLogBytes);

      return {
        checkRunId: checkRun.id,
        name: checkRun.name,
        source: "github_actions_job",
        workflowRunId: checkRun.workflowRunId,
        workflowJobId,
        ...sanitized
      };
    } catch (error) {
      return toUnavailableLog(checkRun, mapLogFetchFailure(error), renderGitHubFailureDetail(error, "fetching Actions logs"));
    }
  }

  private async requestJsonWithRetry<T>(request: GitHubRestRequest): Promise<T> {
    return this.requestWithRetry(() => this.client.requestJson<T>(request));
  }

  private async requestTextWithRetry(request: GitHubRestRequest): Promise<string> {
    return this.requestWithRetry(() => this.client.requestText(request));
  }

  private async requestWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt <= this.maxRetries) {
      try {
        return await operation();
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

export class GitHubCiLogFetchRestClient implements GitHubCiLogRestClient {
  constructor(
    private readonly token: string,
    private readonly baseUrl = "https://api.github.com"
  ) {}

  async requestJson<T>(request: GitHubRestRequest): Promise<T> {
    const response = await this.request(request);
    return (await response.json()) as T;
  }

  async requestText(request: GitHubRestRequest): Promise<string> {
    const response = await this.request(request);
    return response.text();
  }

  private async request(request: GitHubRestRequest): Promise<Response> {
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

    return response;
  }
}

export function sanitizeCiLogContent(rawLog: string, maxBytes = DEFAULT_CI_LOG_MAX_BYTES): SanitizedCiLogContent {
  const originalBytes = Buffer.byteLength(rawLog, "utf8");
  const redactedContent = redactCiLogSecrets(rawLog);
  const redactedBytes = Buffer.byteLength(redactedContent, "utf8");
  const truncated = truncateCiLogContent(redactedContent, maxBytes);

  return {
    content: truncated.content,
    originalBytes,
    redactedBytes,
    storedBytes: Buffer.byteLength(truncated.content, "utf8"),
    redacted: redactedContent !== rawLog,
    truncated: truncated.truncated
  };
}

export function redactCiLogSecrets(rawLog: string): string {
  // Security-sensitive: redaction happens before truncation, storage, display, or LLM context packing.
  return rawLog
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, REDACTED_SECRET)
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, REDACTED_SECRET)
    .replace(/\bgh[opsru]_[A-Za-z0-9_]{20,}\b/g, REDACTED_SECRET)
    .replace(/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, REDACTED_SECRET)
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{10,}/gi, `$1${REDACTED_SECRET}`)
    .replace(
      /\b((?:token|secret|password|passwd|api[_-]?key|access[_-]?key|client[_-]?secret|github[_-]?token)\s*[:=]\s*)(["']?)[^\s"'`]+(["']?)/gi,
      (_match, prefix: string, openQuote: string, closeQuote: string) =>
        `${prefix}${openQuote}${REDACTED_SECRET}${closeQuote && openQuote ? closeQuote : ""}`
    );
}

export function truncateCiLogContent(content: string, maxBytes: number): { content: string; truncated: boolean } {
  const limit = Math.max(1, Math.floor(maxBytes));
  const buffer = Buffer.from(content, "utf8");

  if (buffer.byteLength <= limit) {
    return { content, truncated: false };
  }

  const marker = (omittedBytes: number) => `\n${TRUNCATION_MARKER_PREFIX} omitted ${omittedBytes} bytes]...\n`;
  let markerText = marker(buffer.byteLength);
  const markerBytes = Buffer.byteLength(markerText, "utf8");

  if (limit <= markerBytes + 2) {
    return { content: buffer.subarray(0, limit).toString("utf8"), truncated: true };
  }

  const availableBytes = limit - markerBytes;
  let headBytes = Math.max(1, Math.floor(availableBytes * 0.65));
  let tailBytes = Math.max(1, availableBytes - headBytes);
  let omittedBytes = buffer.byteLength - headBytes - tailBytes;
  markerText = marker(omittedBytes);

  while (
    Buffer.byteLength(
      `${buffer.subarray(0, headBytes).toString("utf8")}${markerText}${buffer
        .subarray(buffer.byteLength - tailBytes)
        .toString("utf8")}`,
      "utf8"
    ) > limit &&
    tailBytes > 1
  ) {
    tailBytes -= 1;
    omittedBytes = buffer.byteLength - headBytes - tailBytes;
    markerText = marker(omittedBytes);
  }

  return {
    content: `${buffer.subarray(0, headBytes).toString("utf8")}${markerText}${buffer
      .subarray(buffer.byteLength - tailBytes)
      .toString("utf8")}`,
    truncated: true
  };
}

function readCheckRuns(response: GitHubCheckRunsResponse): GitHubCheckRunResponse[] {
  return Array.isArray(response.check_runs) ? (response.check_runs as GitHubCheckRunResponse[]) : [];
}

function readWorkflowJobs(response: GitHubWorkflowJobsResponse): GitHubWorkflowJobResponse[] {
  return Array.isArray(response.jobs) ? (response.jobs as GitHubWorkflowJobResponse[]) : [];
}

function normalizeCheckRun(checkRun: GitHubCheckRunResponse): WorkerCiCheckRun {
  const detailsUrl = readOptionalString(checkRun.details_url);
  const htmlUrl = readOptionalString(checkRun.html_url);
  const ids = parseGitHubActionsIds(detailsUrl, htmlUrl);

  return {
    id: readRequiredPositiveInteger(checkRun.id, "id"),
    name: readRequiredString(checkRun.name, "name"),
    status: readRequiredString(checkRun.status, "status"),
    conclusion: readRequiredString(checkRun.conclusion, "conclusion"),
    appSlug: readGitHubAppSlug(checkRun.app),
    detailsUrl,
    htmlUrl,
    workflowRunId: ids.workflowRunId,
    workflowJobId: ids.workflowJobId,
    startedAt: readOptionalString(checkRun.started_at),
    completedAt: readOptionalString(checkRun.completed_at)
  };
}

function isFailedCheckRun(checkRun: WorkerCiCheckRun): boolean {
  return checkRun.status === "completed" && FAILED_CHECK_CONCLUSIONS.has(checkRun.conclusion);
}

function isGitHubActionsCheckRun(checkRun: WorkerCiCheckRun): boolean {
  return (
    checkRun.appSlug === "github-actions" ||
    checkRun.detailsUrl?.includes("/actions/runs/") === true ||
    checkRun.htmlUrl?.includes("/actions/runs/") === true
  );
}

function parseGitHubActionsIds(...urls: (string | null)[]): GitHubActionsIds {
  let workflowRunId: number | null = null;
  let workflowJobId: number | null = null;

  for (const value of urls) {
    if (value === null) {
      continue;
    }

    const path = parseUrlPath(value);
    const runMatch = /\/actions\/runs\/(\d+)/.exec(path);
    const jobMatch = /\/actions\/runs\/\d+\/(?:attempts\/\d+\/)?jobs?\/(\d+)/.exec(path);

    workflowRunId ??= runMatch === null ? null : Number(runMatch[1]);
    workflowJobId ??= jobMatch === null ? null : Number(jobMatch[1]);
  }

  return { workflowRunId, workflowJobId };
}

function parseUrlPath(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
}

function readGitHubAppSlug(app: unknown): string | null {
  if (app === null || typeof app !== "object" || Array.isArray(app)) {
    return null;
  }

  const slug = "slug" in app ? app.slug : null;
  const name = "name" in app ? app.name : null;

  if (typeof slug === "string" && slug.trim()) {
    return slug;
  }

  return typeof name === "string" && name.trim() ? name.toLowerCase().replace(/\s+/g, "-") : null;
}

function toUnavailableLog(
  checkRun: WorkerCiCheckRun,
  reason: WorkerCiLogUnavailableReason,
  detail: string
): WorkerUnavailableCiLog {
  return {
    checkRunId: checkRun.id,
    name: checkRun.name,
    reason,
    detail
  };
}

function mapCheckRunListFailure(error: unknown): WorkerCiLogUnavailableReason | null {
  const status = readErrorStatus(error);

  if (status === 403) {
    return "missing_checks_permission";
  }

  if (status === 404 || status === 410) {
    return "checks_unavailable";
  }

  return null;
}

function mapLogFetchFailure(error: unknown): WorkerCiLogUnavailableReason {
  const status = readErrorStatus(error);

  if (status === 403) {
    return "missing_actions_permission";
  }

  if (status === 404) {
    return "log_not_found";
  }

  if (status === 410) {
    return "log_expired";
  }

  return "github_request_failed";
}

function renderGitHubFailureDetail(error: unknown, action: string): string {
  const status = readErrorStatus(error);

  if (status !== null) {
    return `GitHub returned ${status} while ${action}.`;
  }

  return error instanceof Error ? error.message.slice(0, 500) : `GitHub request failed while ${action}.`;
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
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  throw new Error(`GitHub check run response is missing ${key}`);
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readRequiredPositiveInteger(value: unknown, key: string): number {
  const parsed = readOptionalPositiveInteger(value);

  if (parsed !== null) {
    return parsed;
  }

  throw new Error(`GitHub check run response is missing ${key}`);
}

function readOptionalPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value);
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}
