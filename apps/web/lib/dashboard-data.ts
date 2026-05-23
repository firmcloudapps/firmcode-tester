import type {
  DashboardRepositoryListFilters,
  FindingsListFilters,
  FindingsListResponse,
  OverviewDashboardData,
  RepositoryListResponse,
  ReviewRunDetail,
  ReviewRunListFilters,
  ReviewRunListResponse,
  WorkspaceSettingsResponse
} from "@firmcode/shared";
import { createDashboardApiHeaders } from "./dashboard-api-proxy";
import { buildOverviewDashboardData } from "./overview-data";
import type { ViewState } from "./view-state";

type SearchParams = Record<string, string | string[] | undefined>;

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
    const data = await requestJson<FindingsListResponse>("/api/findings", filters);

    return data.findings.length === 0 ? { status: "empty", data } : { status: "populated", data };
  } catch (error) {
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

export async function loadReviewRunDetailState(reviewRunId: string): Promise<ViewState<ReviewRunDetail>> {
  try {
    const data = await requestJson<ReviewRunDetail>(`/api/review-runs/${encodeURIComponent(reviewRunId)}`, {});

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

async function requestJson<T>(path: string, query: object): Promise<T> {
  const url = new URL(path, getApiBaseUrl());

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new DashboardApiError(`Dashboard API returned ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

async function requestAuthenticatedJson<T>(path: string): Promise<T> {
  const url = new URL(path, getApiBaseUrl());
  const response = await fetch(url, {
    cache: "no-store",
    headers: createDashboardApiHeaders(process.env, false)
  });

  if (!response.ok) {
    throw new DashboardApiError(`Dashboard API returned ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
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

function readSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value === "" ? undefined : value;
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
