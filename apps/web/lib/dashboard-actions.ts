import type {
  CodebaseScanEnqueueResponse,
  CodebaseScanFindingInboxItem,
  GitHubInstallationSyncResponse,
  GitHubRepositorySyncResponse,
  RepositoryReviewConfiguration,
  RulesPolicyResponse,
  ReviewRunRetryResponse,
  ReviewRunStatus,
  UpdateRepositoryReviewConfigurationRequest,
  UpdateReviewPolicyRequest,
  WorkspaceSettingsMember
} from "@firmcode/shared";

export type DashboardMutationFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class DashboardMutationError extends Error {
  constructor(
    message: string,
    readonly status: number | null
  ) {
    super(message);
    this.name = "DashboardMutationError";
  }
}

export class DuplicateDashboardActionError extends Error {
  constructor() {
    super("A request is already pending.");
    this.name = "DuplicateDashboardActionError";
  }
}

export interface PendingActionGuard {
  readonly isPending: boolean;
  run<T>(action: () => Promise<T>): Promise<T>;
}

export function createPendingActionGuard(): PendingActionGuard {
  let pending = false;

  return {
    get isPending() {
      return pending;
    },
    async run<T>(action: () => Promise<T>): Promise<T> {
      if (pending) {
        throw new DuplicateDashboardActionError();
      }

      pending = true;

      try {
        return await action();
      } finally {
        pending = false;
      }
    }
  };
}

export function isReviewRunRetryable(status: ReviewRunStatus, errorCode?: string | null): boolean {
  return status === "failed" && errorCode !== "invalid_job_payload";
}

export async function requestReviewRunRetry(
  reviewRunId: string,
  fetcher: DashboardMutationFetcher = fetch
): Promise<ReviewRunRetryResponse> {
  const response = await fetcher(`/api/review-runs/${encodeURIComponent(reviewRunId)}/retry`, {
    method: "POST",
    headers: {
      accept: "application/json"
    }
  });

  return readMutationResponse<ReviewRunRetryResponse>(response, "Review retry could not be queued.");
}

export async function syncGitHubInstallations(
  installationId?: number,
  fetcher: DashboardMutationFetcher = fetch
): Promise<GitHubInstallationSyncResponse> {
  const response = await fetcher("/api/github/installations/sync", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(installationId === undefined ? {} : { installationId })
  });

  return readMutationResponse<GitHubInstallationSyncResponse>(response, "GitHub installation sync could not be completed.");
}

export async function syncGitHubRepository(
  repositoryId: string,
  fetcher: DashboardMutationFetcher = fetch
): Promise<GitHubRepositorySyncResponse> {
  const response = await fetcher(`/api/repositories/${encodeURIComponent(repositoryId)}/sync`, {
    method: "POST",
    headers: {
      accept: "application/json"
    }
  });

  return readMutationResponse<GitHubRepositorySyncResponse>(response, "Repository sync could not be completed.");
}

export async function updateRepositoryAutomation(
  repositoryId: string,
  automationEnabled: boolean,
  fetcher: DashboardMutationFetcher = fetch
): Promise<RepositoryReviewConfiguration> {
  return updateRepositoryConfiguration(repositoryId, { automationEnabled }, fetcher);
}

export async function updateRepositoryConfiguration(
  repositoryId: string,
  updates: UpdateRepositoryReviewConfigurationRequest,
  fetcher: DashboardMutationFetcher = fetch
): Promise<RepositoryReviewConfiguration> {
  const response = await fetcher(`/api/repositories/${encodeURIComponent(repositoryId)}/configuration`, {
    method: "PATCH",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(updates)
  });

  return readMutationResponse<RepositoryReviewConfiguration>(response, "Repository configuration could not be updated.");
}

export async function requestCodebaseScan(
  repositoryId: string,
  fetcher: DashboardMutationFetcher = fetch
): Promise<CodebaseScanEnqueueResponse> {
  const response = await fetcher(`/api/repositories/${encodeURIComponent(repositoryId)}/codebase-scans`, {
    method: "POST",
    headers: {
      accept: "application/json"
    }
  });

  return readMutationResponse<CodebaseScanEnqueueResponse>(response, "Codebase scan could not be queued.");
}

export async function updateCodebaseFindingStatus(
  findingId: string,
  status: CodebaseScanFindingInboxItem["status"],
  reason: string | null = null,
  fetcher: DashboardMutationFetcher = fetch
): Promise<CodebaseScanFindingInboxItem> {
  const response = await fetcher(`/api/codebase-findings/${encodeURIComponent(findingId)}`, {
    method: "PATCH",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({ status, reason })
  });

  return readMutationResponse<CodebaseScanFindingInboxItem>(response, "Codebase finding status could not be updated.");
}

export async function updateReviewPolicy(
  policy: UpdateReviewPolicyRequest,
  fetcher: DashboardMutationFetcher = fetch
): Promise<RulesPolicyResponse> {
  const response = await fetcher("/api/rules", {
    method: "PATCH",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify(policy)
  });

  return readMutationResponse<RulesPolicyResponse>(response, "Rules policy could not be updated.");
}

export async function updateWorkspaceMemberRole(
  clerkUserId: string,
  role: "admin" | "developer",
  fetcher: DashboardMutationFetcher = fetch
): Promise<WorkspaceSettingsMember> {
  const response = await fetcher(`/api/settings/members/${encodeURIComponent(clerkUserId)}/role`, {
    method: "PATCH",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({ role })
  });

  return readMutationResponse<WorkspaceSettingsMember>(response, "Workspace member role could not be updated.");
}

export async function updateWorkspaceMemberStatus(
  clerkUserId: string,
  active: boolean,
  fetcher: DashboardMutationFetcher = fetch
): Promise<WorkspaceSettingsMember> {
  const response = await fetcher(`/api/settings/members/${encodeURIComponent(clerkUserId)}/status`, {
    method: "PATCH",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({ active })
  });

  return readMutationResponse<WorkspaceSettingsMember>(response, "Workspace member status could not be updated.");
}

export function toRetryFeedbackMessage(response: ReviewRunRetryResponse): string {
  if (response.reason === "duplicate_retry") {
    return "A retry is already queued for this failed run.";
  }

  return response.retryRunId === null
    ? response.message
    : `Retry queued as run ${response.retryRunId.slice(0, 8)}.`;
}

export function toGitHubInstallationSyncFeedbackMessage(response: GitHubInstallationSyncResponse): string {
  return response.syncedRepositoryCount === 1
    ? "Synced 1 GitHub repository."
    : `Synced ${response.syncedRepositoryCount} GitHub repositories.`;
}

export function toGitHubRepositorySyncFeedbackMessage(response: GitHubRepositorySyncResponse): string {
  return `Synced ${response.repository.fullName}.`;
}

export function toCodebaseScanFeedbackMessage(response: CodebaseScanEnqueueResponse): string {
  if (response.duplicate) {
    return `A codebase scan is already ${response.status} for this repository.`;
  }

  return `Codebase scan queued as ${response.scanRunId.slice(0, 8)}.`;
}

export function toReviewPolicyFeedbackMessage(response: RulesPolicyResponse): string {
  const policy = response.selectedRepositoryPolicy ?? response.workspacePolicy;
  return policy.repositoryId === null ? "Workspace policy saved." : "Repository policy saved.";
}

async function readMutationResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw new DashboardMutationError(readErrorMessage(payload, fallbackMessage), response.status);
  }

  return payload as T;
}

async function readJsonPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readErrorMessage(payload: unknown, fallbackMessage: string): string {
  if (payload !== null && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (typeof record.message === "string") {
      return record.message;
    }

    if (record.message !== null && typeof record.message === "object") {
      const nested = record.message as Record<string, unknown>;

      if (typeof nested.message === "string") {
        return nested.message;
      }
    }

    if (typeof record.error === "string") {
      return record.error;
    }
  }

  return fallbackMessage;
}
