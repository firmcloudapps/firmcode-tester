import React from "react";
import { renderToString } from "react-dom/server";
import type { RepositoryReviewConfiguration, ReviewRunRetryResponse } from "@firmcode/shared";
import { RepositoryAutomationToggle } from "../components/dashboard/repository-automation-toggle";
import { RetryReviewRunButton } from "../components/dashboard/retry-review-run-button";
import {
  createPendingActionGuard,
  DashboardMutationError,
  DuplicateDashboardActionError,
  requestReviewRunRetry,
  updateRepositoryAutomation
} from "../lib/dashboard-actions";
import { createDashboardApiHeaders } from "../lib/dashboard-api-proxy";

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

  it("forwards dashboard auth headers from the server-side proxy environment", () => {
    const headers = createDashboardApiHeaders(
      {
        FIRMCODE_DASHBOARD_WORKSPACE_ID: "00000000-0000-4000-8000-000000000101",
        FIRMCODE_DASHBOARD_CLERK_USER_ID: "user_admin",
        FIRMCODE_DASHBOARD_CLERK_BILLING_CAPABILITY: "manage_billing"
      },
      true
    );

    expect(headers.get("x-firmcode-workspace-id")).toBe("00000000-0000-4000-8000-000000000101");
    expect(headers.get("x-firmcode-user-id")).toBe("user_admin");
    expect(headers.get("x-firmcode-clerk-billing-capability")).toBe("manage_billing");
    expect(headers.get("content-type")).toBe("application/json");
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}
