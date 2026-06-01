import React from "react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import type { RepositoryReviewConfiguration, ReviewRunRetryResponse } from "@firmcode/shared";
import { GitHubInstallationSyncButton, GitHubRepositorySyncButton } from "../components/dashboard/github-sync-controls";
import { RepositoryAutomationToggle } from "../components/dashboard/repository-automation-toggle";
import { RetryReviewRunButton } from "../components/dashboard/retry-review-run-button";
import {
  createPendingActionGuard,
  DashboardMutationError,
  DuplicateDashboardActionError,
  requestCodebaseScan,
  requestReviewRunRetry,
  syncGitHubInstallations,
  syncGitHubRepository,
  updateCodebaseFindingStatus,
  updateRepositoryAutomation
} from "../lib/dashboard-actions";
import { createDashboardApiHeaders, getDashboardApiBaseUrl } from "../lib/dashboard-api-proxy";

describe("dashboard retry controls", () => {
  it("queues a retry through the typed dashboard mutation endpoint", async () => {
    const fetcher = vi.fn(async () => jsonResponse(retryResponse));

    await expect(requestReviewRunRetry("run-1", fetcher)).resolves.toEqual(retryResponse);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("/api/review-runs/run-1/retry", {
      method: "POST",
      headers: {
        accept: "application/json"
      }
    });
  });

  it("surfaces retry failure messages from validation or authorization responses", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(
        {
          message: {
            message: "payload failed validation"
          }
        },
        409
      )
    );

    await expect(requestReviewRunRetry("run-1", fetcher)).rejects.toMatchObject({
      message: "payload failed validation",
      status: 409
    } satisfies Partial<DashboardMutationError>);
  });

  it("prevents duplicate retry submissions while a request is pending", async () => {
    const guard = createPendingActionGuard();
    let releaseRequest!: (value: string) => void;
    const firstRequest = guard.run(
      () =>
        new Promise<string>((resolve) => {
          releaseRequest = resolve;
        })
    );

    await expect(guard.run(() => Promise.resolve("duplicate"))).rejects.toThrow(DuplicateDashboardActionError);
    expect(guard.isPending).toBe(true);

    releaseRequest("queued");

    await expect(firstRequest).resolves.toBe("queued");
    expect(guard.isPending).toBe(false);
  });

  it("renders disabled retry states for non-failed and deterministic validation failures", () => {
    const succeededHtml = renderToString(<RetryReviewRunButton reviewRunId="run-1" status="succeeded" />);
    const deterministicHtml = renderToString(
      <RetryReviewRunButton errorCode="invalid_job_payload" reviewRunId="run-2" status="failed" />
    );

    expect(succeededHtml).toContain("Only failed review runs can be retried.");
    expect(deterministicHtml).toContain("needs configuration changes before retrying");
  });
});

describe("repository automation controls", () => {
  it("updates repository automation through the typed dashboard mutation endpoint", async () => {
    const fetcher = vi.fn(async () => jsonResponse(repositoryConfiguration));

    await expect(updateRepositoryAutomation("repo-1", false, fetcher)).resolves.toEqual(repositoryConfiguration);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("/api/repositories/repo-1/configuration", {
      method: "PATCH",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify({ automationEnabled: false })
    });
  });

  it("surfaces repository automation validation and authorization failures", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ message: "Workspace role cannot manage repository configuration" }, 403));

    await expect(updateRepositoryAutomation("repo-1", true, fetcher)).rejects.toMatchObject({
      message: "Workspace role cannot manage repository configuration",
      status: 403
    } satisfies Partial<DashboardMutationError>);
  });

  it("renders an accessible switch with persisted initial API state", () => {
    const html = renderToString(<RepositoryAutomationToggle initialEnabled repositoryId="repo-1" />);

    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Enabled");
  });

  it("forwards a Clerk bearer token and optional workspace selector from the explicit test environment", async () => {
    const headers = await createDashboardApiHeaders(
      {
        FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN: "session-token",
        FIRMCODE_TEST_DASHBOARD_WORKSPACE_ID: "00000000-0000-4000-8000-000000000101"
      },
      true
    );

    expect(headers).not.toBeNull();
    expect(headers?.get("authorization")).toBe("Bearer session-token");
    expect(headers?.get("x-firmcode-workspace-id")).toBe("00000000-0000-4000-8000-000000000101");
    expect(headers?.get("x-firmcode-user-id")).toBeNull();
    expect(headers?.get("x-firmcode-clerk-billing-capability")).toBeNull();
    expect(headers?.get("content-type")).toBe("application/json");
  });

  it("ignores legacy dashboard user-id shim variables when a Clerk token is available", async () => {
    const headers = await createDashboardApiHeaders(
      {
        FIRMCODE_TEST_DASHBOARD_CLERK_SESSION_TOKEN: "session-token",
        FIRMCODE_DASHBOARD_WORKSPACE_ID: "00000000-0000-4000-8000-000000000101",
        FIRMCODE_DASHBOARD_CLERK_USER_ID: "user_admin"
      },
      false
    );

    expect(headers).not.toBeNull();
    expect(headers?.get("authorization")).toBe("Bearer session-token");
    expect(headers?.get("x-firmcode-user-id")).toBeNull();
    expect(headers?.get("x-firmcode-workspace-id")).toBeNull();
  });

  it("prefers the server API URL over the public dashboard URL for server-side API calls", () => {
    expect(
      getDashboardApiBaseUrl({
        API_URL: "https://firmcodeapi.example.test",
        NEXT_PUBLIC_API_URL: "https://firmcode.example.test"
      })
    ).toBe("https://firmcodeapi.example.test");
    expect(getDashboardApiBaseUrl({ NEXT_PUBLIC_API_URL: "https://firmcodeapi.example.test" })).toBe(
      "https://firmcodeapi.example.test"
    );
  });
});

describe("codebase scan dashboard actions", () => {
  it("queues manual codebase scans through the typed dashboard mutation endpoint", async () => {
    const response = {
      scanRunId: "scan-1",
      jobId: "job-1",
      repositoryId: "repo-1",
      repositoryFullName: "openclaw/firmcode",
      trigger: "manual",
      status: "queued",
      commitSha: null,
      correlationId: "correlation-1",
      created: true,
      duplicate: false
    } as const;
    const fetcher = vi.fn(async () => jsonResponse(response));

    await expect(requestCodebaseScan("repo-1", fetcher)).resolves.toEqual(response);
    expect(fetcher).toHaveBeenCalledWith("/api/repositories/repo-1/codebase-scans", {
      method: "POST",
      headers: {
        accept: "application/json"
      }
    });
  });

  it("updates codebase finding status with an auditable reason", async () => {
    const response = {
      id: "finding-1",
      status: "false_positive"
    };
    const fetcher = vi.fn(async () => jsonResponse(response));

    await expect(updateCodebaseFindingStatus("finding-1", "false_positive", "Generated fixture.", fetcher)).resolves.toEqual(response);
    expect(fetcher).toHaveBeenCalledWith("/api/codebase-findings/finding-1", {
      method: "PATCH",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify({ status: "false_positive", reason: "Generated fixture." })
    });
  });
});

describe("GitHub sync controls", () => {
  it("syncs all GitHub installations through the typed dashboard mutation endpoint", async () => {
    const fetcher = vi.fn(async () => jsonResponse(installationSyncResponse));

    await expect(syncGitHubInstallations(undefined, fetcher)).resolves.toEqual(installationSyncResponse);
    expect(fetcher).toHaveBeenCalledWith("/api/github/installations/sync", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });
  });

  it("syncs a single repository through the implemented repository endpoint", async () => {
    const fetcher = vi.fn(async () => jsonResponse(repositorySyncResponse));

    await expect(syncGitHubRepository("repo-1", fetcher)).resolves.toEqual(repositorySyncResponse);
    expect(fetcher).toHaveBeenCalledWith("/api/repositories/repo-1/sync", {
      method: "POST",
      headers: {
        accept: "application/json"
      }
    });
  });

  it("surfaces GitHub sync errors and uses the pending guard to block duplicate clicks", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ message: "Workspace role cannot manage GitHub installations" }, 403));

    await expect(syncGitHubInstallations(301, fetcher)).rejects.toMatchObject({
      message: "Workspace role cannot manage GitHub installations",
      status: 403
    } satisfies Partial<DashboardMutationError>);

    const guard = createPendingActionGuard();
    let releaseRequest!: (value: string) => void;
    const firstRequest = guard.run(
      () =>
        new Promise<string>((resolve) => {
          releaseRequest = resolve;
        })
    );

    await expect(guard.run(() => Promise.resolve("duplicate sync"))).rejects.toThrow(DuplicateDashboardActionError);
    releaseRequest("synced");
    await expect(firstRequest).resolves.toBe("synced");
  });

  it("shows installation sync loading and success feedback from the button click handler", async () => {
    const { button, feedbackSetter, pendingSetter, restore } = renderSyncButtonForClick(
      <GitHubInstallationSyncButton installationId={301} />
    );
    const fetcher = vi.fn(async () => jsonResponse(installationSyncResponse));
    vi.stubGlobal("fetch", fetcher);

    try {
      await button.props.onClick();

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(pendingSetter).toHaveBeenCalledWith(true);
      expect(feedbackSetter).toHaveBeenCalledWith(null);
      expect(feedbackSetter).toHaveBeenCalledWith({
        tone: "success",
        message: "Synced 2 GitHub repositories."
      });
      expect(pendingSetter).toHaveBeenLastCalledWith(false);
    } finally {
      restore();
      vi.unstubAllGlobals();
    }
  });

  it("shows repository sync error feedback from the button click handler", async () => {
    const { button, feedbackSetter, restore } = renderSyncButtonForClick(
      <GitHubRepositorySyncButton repositoryId="repo-1" />
    );
    const fetcher = vi.fn(async () => jsonResponse({ message: "Repository not found" }, 404));
    vi.stubGlobal("fetch", fetcher);

    try {
      await button.props.onClick();

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(feedbackSetter).toHaveBeenCalledWith({
        tone: "error",
        message: "Repository not found"
      });
    } finally {
      restore();
      vi.unstubAllGlobals();
    }
  });

  it("blocks duplicate installation sync button clicks while the first request is in flight", async () => {
    const { button, restore } = renderSyncButtonForClick(<GitHubInstallationSyncButton />);
    let releaseRequest!: () => void;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          releaseRequest = () => resolve(jsonResponse(installationSyncResponse));
        })
    );
    vi.stubGlobal("fetch", fetcher);

    try {
      const firstClick = button.props.onClick();
      const duplicateClick = button.props.onClick();

      expect(fetcher).toHaveBeenCalledTimes(1);

      releaseRequest();

      await Promise.all([firstClick, duplicateClick]);
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      restore();
      vi.unstubAllGlobals();
    }
  });
});

const retryResponse: ReviewRunRetryResponse = {
  originalRunId: "run-1",
  retryRunId: "run-2",
  retryJobId: "retry:run-1",
  status: "queued",
  reason: "retry_queued",
  message: "Review retry queued."
};

const repositoryConfiguration: RepositoryReviewConfiguration = {
  repositoryId: "repo-1",
  automationEnabled: false,
  draftPullRequestReviewsEnabled: false,
  maxInlineComments: 10,
  severityThreshold: "medium",
  semgrepEnabled: true,
  treeSitterEnabled: true,
  ciExplanationEnabled: true,
  infrastructureReviewEnabled: true,
  dryRunEnabled: true,
  updatedByClerkUserId: "user_admin",
  createdAt: "2026-05-23T10:00:00.000Z",
  updatedAt: "2026-05-23T10:01:00.000Z"
};

const installationSyncResponse = {
  installations: [
    {
      id: "install-1",
      installationId: 301,
      accountLogin: "openclaw",
      accountType: "Organization",
      repositoryCount: 2,
      enabledRepositoryCount: 1,
      updatedAt: "2026-05-23T10:00:00.000Z"
    }
  ],
  syncedRepositoryCount: 2
};

const repositorySyncResponse = {
  repository: {
    id: "repo-1",
    owner: "openclaw",
    name: "firmcode",
    fullName: "openclaw/firmcode",
    private: false,
    defaultBranch: "main",
    enabled: true,
    primaryLanguage: null,
    openFindingsCount: 0,
    lastReview: null,
    updatedAt: "2026-05-23T10:00:00.000Z"
  }
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function renderSyncButtonForClick(element: ReactElement): {
  button: ReactElement<{ onClick: () => Promise<void> }>;
  pendingSetter: ReturnType<typeof vi.fn>;
  feedbackSetter: ReturnType<typeof vi.fn>;
  restore: () => void;
} {
  const pendingSetter = vi.fn();
  const feedbackSetter = vi.fn();
  const stateSetters = [pendingSetter, feedbackSetter];
  const useStateSpy = vi.spyOn(React, "useState");
  const useRefSpy = vi.spyOn(React, "useRef");

  useStateSpy.mockImplementation(((initialState?: unknown) => {
    const setter = stateSetters.shift() ?? vi.fn();
    return [initialState, setter] as never;
  }) as never);
  useRefSpy.mockImplementation((initialValue: unknown) => ({ current: initialValue }) as never);

  if (typeof element.type !== "function") {
    throw new Error("Sync control must be a function component.");
  }

  const rendered = (element.type as (props: unknown) => ReactElement)(element.props);
  const button = findElementByType(rendered, "button");

  if (button === null || typeof button.props.onClick !== "function") {
    throw new Error("Sync button click handler could not be found.");
  }

  return {
    button: button as ReactElement<{ onClick: () => Promise<void> }>,
    pendingSetter,
    feedbackSetter,
    restore: () => {
      useStateSpy.mockRestore();
      useRefSpy.mockRestore();
    }
  };
}

function findElementByType(element: unknown, type: string): ReactElement | null {
  if (!React.isValidElement(element)) {
    return null;
  }

  if (element.type === type) {
    return element;
  }

  const props = element.props as { children?: React.ReactNode };
  const children = React.Children.toArray(props.children);

  for (const child of children) {
    const found = findElementByType(child, type);

    if (found !== null) {
      return found;
    }
  }

  return null;
}
