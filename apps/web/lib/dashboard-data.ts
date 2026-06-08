import type {
  CiFailureDetailResponse,
  CiFailureListFilters,
  CiFailureListResponse,
  DashboardRepositoryListFilters,
  FindingsListFilters,
  FindingsListResponse,
  GitHubOAuthStatusResponse,
  OverviewDashboardData,
  PlatformAdminOverviewResponse,
  PullRequestDetailResponse,
  PullRequestListFilters,
  PullRequestListResponse,
  RepositoryDetailResponse,
  RepositoryListResponse,
  RulesPolicyResponse,
  ReviewRunDetail,
  ReviewRunListFilters,
  ReviewRunListResponse,
  WorkspaceBillingResponse,
  WorkspaceSettingsResponse
} from "@firmcode/shared";
import { createDashboardApiHeaders, getDashboardApiBaseUrl } from "./dashboard-api-proxy";
import { buildOverviewDashboardData } from "./overview-data";
import type { ViewState } from "./view-state";

export interface AdminOverviewData {
  overview: PlatformAdminOverviewResponse;
  settings: WorkspaceSettingsResponse;
  billing: WorkspaceBillingResponse | null;
}

type SearchParams = Record<string, string | string[] | undefined>;

export type GitHubInstallationsState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "empty"; data: GitHubSyncDashboardData }
  | { status: "error"; message: string }
  | { status: "populated"; data: GitHubSyncDashboardData };

export interface GitHubSyncDashboardData {
  settings: WorkspaceSettingsResponse;
  oauth: GitHubOAuthStatusResponse;
  repositories: RepositoryListResponse;
}

export interface DeveloperPrReviewData {
  settings: WorkspaceSettingsResponse;
  oauth: GitHubOAuthStatusResponse;
  reviewRuns: ReviewRunListResponse;
}

export type DeveloperPrReviewState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "empty"; data: DeveloperPrReviewData }
  | { status: "error"; message: string }
  | { status: "populated"; data: DeveloperPrReviewData };

export type GitHubRepositoryControlsState =
  | { status: "ready"; data: Pick<GitHubSyncDashboardData, "settings" | "oauth"> }
  | { status: "signed-out" }
  | { status: "error"; message: string };

class DashboardApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null
  ) {
    super(message);
    this.name = "DashboardApiError";
  }
}

export async function loadRepositoriesState(searchParams: SearchParams): Promise<ViewState<RepositoryListResponse>> {
  try {
    const filters = pickRepositoryFilters(searchParams);
    const data = await requestJson<RepositoryListResponse>("/api/repositories", filters);

    return data.repositories.length === 0 ? { status: "empty", data } : { status: "populated", data };
  } catch (error) {
    return { status: "error", message: toErrorMessage(error) };
  }
}

export async function loadRepositoryDetailState(repositoryId: string): Promise<ViewState<RepositoryDetailResponse>> {
  try {
    const data = await requestAuthenticatedJson<RepositoryDetailResponse>(`/api/repositories/${encodeURIComponent(repositoryId)}`);

    return { status: "populated", data };
  } catch (error) {
    if (error instanceof DashboardApiError && error.status === 404) {
      return { status: "empty" };
    }

    return { status: "error", message: toErrorMessage(error) };
  }
}

export async function loadOverviewState(): Promise<ViewState<OverviewDashboardData>> {
  try {
    const [repositories, reviewRuns] = await Promise.all([
      requestJson<RepositoryListResponse>("/api/repositories", {}),
      requestJson<ReviewRunListResponse>("/api/review-runs", {})
    ]);
    const data = buildOverviewDashboardData({
      repositories: repositories.repositories,
      reviewRuns: reviewRuns.reviewRuns
    });

    return data.recentReviewRuns.length === 0 && data.needsAttention.length === 0
      ? { status: "empty", data }
      : { status: "populated", data };
  } catch (error) {
    return { status: "error", message: toErrorMessage(error) };
  }
}

export async function loadReviewRunsState(searchParams: SearchParams): Promise<ViewState<ReviewRunListResponse>> {
  try {
    const filters = pickReviewRunFilters(searchParams);
    const data = await requestJson<ReviewRunListResponse>("/api/review-runs", filters);

    return data.reviewRuns.length === 0 ? { status: "empty", data } : { status: "populated", data };
  } catch (error) {
    return { status: "error", message: toErrorMessage(error) };
  }
}

export async function loadFindingsState(searchParams: SearchParams): Promise<ViewState<FindingsListResponse>> {
  try {
    const filters = pickFindingsFilters(searchParams);
    const data = await requestAuthenticatedJsonWithQuery<FindingsListResponse>("/api/findings", filters);

    return data.findings.length === 0 ? { status: "empty", data } : { status: "populated", data };
  } catch (error) {
    return { status: "error", message: toErrorMessage(error) };
  }
}

export async function loadPullRequestsState(searchParams: SearchParams): Promise<ViewState<PullRequestListResponse>> {
  try {
    const filters = pickPullRequestFilters(searchParams);
    const data = await requestAuthenticatedJsonWithQuery<PullRequestListResponse>("/api/pull-requests", filters);

    return data.pullRequests.length === 0 ? { status: "empty", data } : { status: "populated", data };
  } catch (error) {
    return { status: "error", message: toErrorMessage(error) };
  }
}

export async function loadPullRequestDetailState(pullRequestId: string): Promise<ViewState<PullRequestDetailResponse>> {
  try {
    const data = await requestAuthenticatedJson<PullRequestDetailResponse>(`/api/pull-requests/${encodeURIComponent(pullRequestId)}`);

    return { status: "populated", data };
  } catch (error) {
    if (error instanceof DashboardApiError && error.status === 404) {
      return { status: "empty" };
    }

    return { status: "error", message: toErrorMessage(error) };
  }
}

export async function loadCiFailuresState(searchParams: SearchParams): Promise<ViewState<CiFailureListResponse>> {
  try {
    const filters = pickCiFailureFilters(searchParams);
    const data = await requestAuthenticatedJsonWithQuery<CiFailureListResponse>("/api/ci-failures", filters);

    return data.ciFailures.length === 0 ? { status: "empty", data } : { status: "populated", data };
  } catch (error) {
    return { status: "error", message: toErrorMessage(error) };
  }
}

export async function loadCiFailureDetailState(ciFailureId: string): Promise<ViewState<CiFailureDetailResponse>> {
  try {
    const data = await requestAuthenticatedJson<CiFailureDetailResponse>(
      `/api/ci-failures/${encodeURIComponent(decodeRouteSegment(ciFailureId))}`
    );

    return { status: "populated", data };
  } catch (error) {
    if (error instanceof DashboardApiError && error.status === 404) {
      return { status: "empty" };
    }

    return { status: "error", message: toErrorMessage(error) };
  }
}

export async function loadSettingsState(): Promise<ViewState<WorkspaceSettingsResponse>> {
  try {
    const data = await requestAuthenticatedJson<WorkspaceSettingsResponse>("/api/settings");

    return data.githubApp.installations.length === 0 ? { status: "empty", data } : { status: "populated", data };
  } catch (error) {
    return { status: "error", message: toErrorMessage(error) };
  }
}

export async function loadRulesState(searchParams: SearchParams = {}): Promise<ViewState<RulesPolicyResponse>> {
  try {
    const repositoryId = readSingleValue(searchParams.repositoryId);
    const data = await requestAuthenticatedJson<RulesPolicyResponse>(
      repositoryId === undefined ? "/api/rules" : `/api/rules?repositoryId=${encodeURIComponent(repositoryId)}`
    );

    return data.repositoryPolicies.length === 0 ? { status: "empty", data } : { status: "populated", data };
  } catch (error) {
    return { status: "error", message: toErrorMessage(error) };
  }
}

export async function loadGitHubInstallationsState(): Promise<GitHubInstallationsState> {
  try {
    const [settings, oauth, repositories] = await Promise.all([
      requestAuthenticatedJson<WorkspaceSettingsResponse>("/api/settings"),
      requestAuthenticatedJson<GitHubOAuthStatusResponse>("/api/github/oauth/status"),
      requestJson<RepositoryListResponse>("/api/repositories", {})
    ]);
    const data = { settings, oauth, repositories };

    return settings.githubApp.installations.length === 0 ? { status: "empty", data } : { status: "populated", data };
  } catch (error) {
    if (error instanceof DashboardApiError && error.status === 401) {
      return { status: "signed-out" };
    }

    return { status: "error", message: toErrorMessage(error) };
  }
}

export async function loadDeveloperPrReviewState(): Promise<DeveloperPrReviewState> {
  try {
    const [settings, oauth, reviewRuns] = await Promise.all([
      requestAuthenticatedJson<WorkspaceSettingsResponse>("/api/settings"),
      requestAuthenticatedJson<GitHubOAuthStatusResponse>("/api/github/oauth/status"),
      requestJson<ReviewRunListResponse>("/api/review-runs", {})
    ]);
    const data = { settings, oauth, reviewRuns };

    return reviewRuns.reviewRuns.length === 0 ? { status: "empty", data } : { status: "populated", data };
  } catch (error) {
    if (error instanceof DashboardApiError && error.status === 401) {
      return { status: "signed-out" };
    }

    return { status: "error", message: toErrorMessage(error) };
  }
}

export async function loadGitHubRepositoryControlsState(): Promise<GitHubRepositoryControlsState> {
  try {
    const [settings, oauth] = await Promise.all([
      requestAuthenticatedJson<WorkspaceSettingsResponse>("/api/settings"),
      requestAuthenticatedJson<GitHubOAuthStatusResponse>("/api/github/oauth/status")
    ]);

    return { status: "ready", data: { settings, oauth } };
  } catch (error) {
    if (error instanceof DashboardApiError && error.status === 401) {
      return { status: "signed-out" };
    }

    return { status: "error", message: toErrorMessage(error) };
  }
}

export async function loadBillingState(): Promise<ViewState<WorkspaceBillingResponse>> {
  try {
    const data = await requestAuthenticatedJson<WorkspaceBillingResponse>("/api/billing");

    return { status: "populated", data };
  } catch (error) {
    return { status: "error", message: toErrorMessage(error) };
  }
}

export type DashboardRoleResult =
  | { status: "ok"; role: string }
  | { status: "signed-out" }
  | { status: "error" };

export async function loadDashboardRole(): Promise<DashboardRoleResult> {
  try {
    const data = await requestAuthenticatedJson<WorkspaceSettingsResponse>("/api/settings");

    return { status: "ok", role: data.workspace.role };
  } catch (error) {
    if (error instanceof DashboardApiError && error.status === 401) {
      return { status: "signed-out" };
    }

    return { status: "error" };
  }
}

export async function resolveDashboardNavRole(): Promise<string> {
  const result = await loadDashboardRole();

  return result.status === "ok" ? result.role : "developer";
}

export async function loadReviewRunDetailState(reviewRunId: string): Promise<ViewState<ReviewRunDetail>> {
  try {
    const data = await requestAuthenticatedJson<ReviewRunDetail>(`/api/review-runs/${encodeURIComponent(reviewRunId)}`);

    return { status: "populated", data };
  } catch (error) {
    return { status: "error", message: toErrorMessage(error) };
  }
}

function pickRepositoryFilters(searchParams: SearchParams): DashboardRepositoryListFilters {
  return removeUndefinedValues({
    enabled: parseBoolean(readSingleValue(searchParams.enabled)),
    private: parseBoolean(readSingleValue(searchParams.private)),
    language: readSingleValue(searchParams.language)
  });
}

function pickReviewRunFilters(searchParams: SearchParams): ReviewRunListFilters {
  return removeUndefinedValues({
    status: readSingleValue(searchParams.status) as ReviewRunListFilters["status"],
    repositoryId: readSingleValue(searchParams.repositoryId),
    repository: readSingleValue(searchParams.repository),
    triggerEvent: readSingleValue(searchParams.triggerEvent),
    risk: readSingleValue(searchParams.risk) as ReviewRunListFilters["risk"],
    dateFrom: readSingleValue(searchParams.dateFrom),
    dateTo: readSingleValue(searchParams.dateTo)
  });
}

function pickFindingsFilters(searchParams: SearchParams): FindingsListFilters {
  return removeUndefinedValues({
    findingType: readSingleValue(searchParams.findingType) as FindingsListFilters["findingType"],
    severity: readSingleValue(searchParams.severity) as FindingsListFilters["severity"],
    source: readSingleValue(searchParams.source) as FindingsListFilters["source"],
    category: readSingleValue(searchParams.category) as FindingsListFilters["category"],
    repositoryId: readSingleValue(searchParams.repositoryId),
    repository: readSingleValue(searchParams.repository),
    status: readSingleValue(searchParams.status) as FindingsListFilters["status"],
    postedInline: parseBoolean(readSingleValue(searchParams.postedInline)),
    dateFrom: readSingleValue(searchParams.dateFrom),
    dateTo: readSingleValue(searchParams.dateTo)
  });
}

function pickPullRequestFilters(searchParams: SearchParams): PullRequestListFilters {
  const limit = parsePositiveInteger(readSingleValue(searchParams.limit));

  return removeUndefinedValues({
    repositoryId: readSingleValue(searchParams.repositoryId),
    repository: readSingleValue(searchParams.repository),
    status: readSingleValue(searchParams.status) as PullRequestListFilters["status"],
    riskLevel: readSingleValue(searchParams.riskLevel) as PullRequestListFilters["riskLevel"],
    reviewStatus: readSingleValue(searchParams.reviewStatus) as PullRequestListFilters["reviewStatus"],
    author: readSingleValue(searchParams.author),
    dateFrom: readSingleValue(searchParams.dateFrom),
    dateTo: readSingleValue(searchParams.dateTo),
    limit
  });
}

function pickCiFailureFilters(searchParams: SearchParams): CiFailureListFilters {
  const limit = parsePositiveInteger(readSingleValue(searchParams.limit));

  return removeUndefinedValues({
    repositoryId: readSingleValue(searchParams.repositoryId),
    repository: readSingleValue(searchParams.repository),
    status: readSingleValue(searchParams.status) as CiFailureListFilters["status"],
    flaky: parseBoolean(readSingleValue(searchParams.flaky)),
    dateFrom: readSingleValue(searchParams.dateFrom),
    dateTo: readSingleValue(searchParams.dateTo),
    limit
  });
}

async function requestJson<T>(path: string, query: object): Promise<T> {
  const url = new URL(path, getApiBaseUrl());
  const headers = await createDashboardApiHeaders(process.env, false);

  if (headers === null) {
    throw new DashboardApiError("A signed-in session is required.", 401);
  }

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers
  });

  if (!response.ok) {
    throw new DashboardApiError(`Dashboard API returned ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

async function requestAuthenticatedJsonWithQuery<T>(path: string, query: object): Promise<T> {
  const url = new URL(path, getApiBaseUrl());
  const headers = await createDashboardApiHeaders(process.env, false);

  if (headers === null) {
    throw new DashboardApiError("A signed-in session is required.", 401);
  }

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers
  });

  if (!response.ok) {
    throw new DashboardApiError(`Dashboard API returned ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

async function requestAuthenticatedJson<T>(path: string): Promise<T> {
  const url = new URL(path, getApiBaseUrl());
  const headers = await createDashboardApiHeaders(process.env, false);

  if (headers === null) {
    throw new DashboardApiError("A signed-in session is required.", 401);
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers
  });

  if (!response.ok) {
    throw new DashboardApiError(`Dashboard API returned ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

export async function loadAdminOverviewState(): Promise<ViewState<AdminOverviewData>> {
  try {
    const [overview, settings, billing] = await Promise.all([
      requestAuthenticatedJson<PlatformAdminOverviewResponse>("/api/platform/overview"),
      requestAuthenticatedJson<WorkspaceSettingsResponse>("/api/settings"),
      requestAuthenticatedJson<WorkspaceBillingResponse>("/api/billing").catch(() => null)
    ]);

    return { status: "populated", data: { overview, settings, billing } };
  } catch (error) {
    return { status: "error", message: toErrorMessage(error) };
  }
}

function getApiBaseUrl(): string {
  return getDashboardApiBaseUrl(process.env);
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function readSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === "" ? undefined : value;
}

function decodeRouteSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function removeUndefinedValues<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter((entry) => entry[1] !== undefined)) as T;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof DashboardApiError && error.status === 404) {
    return "The requested dashboard resource was not found.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Dashboard data could not be loaded.";
}
