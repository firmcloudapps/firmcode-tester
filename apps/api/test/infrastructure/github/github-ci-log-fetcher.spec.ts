import {
  GitHubCiLogFetchRestClient,
  GitHubPullRequestCiLogFetcher,
  redactCiLogSecrets,
  sanitizeCiLogContent,
  truncateCiLogContent,
  type GitHubCiLogRestClient
} from "../../../src/infrastructure/github/github-ci-log-fetcher";
import { GitHubApiError, type GitHubRestRequest } from "../../../src/infrastructure/github/github-pr-file-fetcher";

class MockGitHubCiLogRestClient implements GitHubCiLogRestClient {
  readonly requests: GitHubRestRequest[] = [];
  private readonly jsonResponses = new Map<string, unknown[]>();
  private readonly textResponses = new Map<string, unknown[]>();

  enqueueJson(path: string, ...responses: unknown[]): void {
    this.jsonResponses.set(path, responses);
  }

  enqueueText(path: string, ...responses: unknown[]): void {
    this.textResponses.set(path, responses);
  }

  async requestJson<T>(request: GitHubRestRequest): Promise<T> {
    this.requests.push(request);
    return this.dequeue<T>(this.jsonResponses, request.path);
  }

  async requestText(request: GitHubRestRequest): Promise<string> {
    this.requests.push(request);
    return this.dequeue<string>(this.textResponses, request.path);
  }

  private dequeue<T>(responses: Map<string, unknown[]>, path: string): T {
    const queuedResponses = responses.get(path);

    if (queuedResponses === undefined || queuedResponses.length === 0) {
      throw new Error(`No mock response queued for ${path}`);
    }

    const response = queuedResponses.shift();

    if (response instanceof Error) {
      throw response;
    }

    return response as T;
  }
}

function createFetcher(client: GitHubCiLogRestClient, maxLogBytes = 20_000): GitHubPullRequestCiLogFetcher {
  return new GitHubPullRequestCiLogFetcher(client, {
    perPage: 2,
    maxLogBytes,
    maxRetries: 1,
    retryDelayMs: 0
  });
}

describe("GitHubPullRequestCiLogFetcher", () => {
  it("fetches failed GitHub Actions check runs and stores only sanitized bounded logs", async () => {
    const client = new MockGitHubCiLogRestClient();
    const pageOnePath = "/repos/acme/widgets/commits/head123/check-runs?per_page=2&page=1";
    const pageTwoPath = "/repos/acme/widgets/commits/head123/check-runs?per_page=2&page=2";
    const logPath = "/repos/acme/widgets/actions/jobs/303/logs";
    const rawLog = [
      "Run npm test",
      "TOKEN=ghp_1234567890abcdefghijklmnopqrstuv",
      "AssertionError: expected status 201",
      "A".repeat(120),
      "final failing line"
    ].join("\n");

    client.enqueueJson(pageOnePath, {
      check_runs: [
        {
          id: 101,
          name: "unit tests",
          status: "completed",
          conclusion: "failure",
          app: { slug: "github-actions" },
          details_url: "https://github.com/acme/widgets/actions/runs/202/job/303",
          html_url: "https://github.com/acme/widgets/actions/runs/202/job/303",
          started_at: "2026-05-23T12:00:00Z",
          completed_at: "2026-05-23T12:02:00Z"
        },
        {
          id: 102,
          name: "lint",
          status: "completed",
          conclusion: "success",
          app: { slug: "github-actions" },
          details_url: "https://github.com/acme/widgets/actions/runs/202/job/304"
        }
      ]
    });
    client.enqueueJson(pageTwoPath, { check_runs: [] });
    client.enqueueText(logPath, rawLog);

    const artifact = await createFetcher(client, 120).fetchFailedCiLogs({
      reviewRunId: "run-1",
      owner: "acme",
      repo: "widgets",
      pullRequestNumber: 17,
      headSha: "head123"
    });

    expect(artifact).toMatchObject({
      schemaVersion: "ci-log-artifact/v1",
      repositoryFullName: "acme/widgets",
      pullRequestNumber: 17,
      headSha: "head123",
      unavailableLogs: []
    });
    expect(artifact.checkRuns).toEqual([
      expect.objectContaining({
        id: 101,
        name: "unit tests",
        conclusion: "failure",
        workflowRunId: 202,
        workflowJobId: 303
      })
    ]);
    expect(artifact.logs).toEqual([
      expect.objectContaining({
        checkRunId: 101,
        workflowRunId: 202,
        workflowJobId: 303,
        redacted: true,
        truncated: true
      })
    ]);
    expect(artifact.logs[0].content).toContain("[REDACTED_SECRET]");
    expect(artifact.logs[0].content).toContain("Firmcode truncated CI log");
    expect(artifact.logs[0].content).not.toContain("ghp_1234567890");
    expect(artifact.logs[0].storedBytes).toBeLessThanOrEqual(120);
    expect(client.requests.map((request) => request.path)).toEqual([pageOnePath, pageTwoPath, logPath]);
  });

  it("resolves a workflow job from the workflow run when the check run URL omits the job id", async () => {
    const client = new MockGitHubCiLogRestClient();
    const checkRunsPath = "/repos/acme/widgets/commits/head456/check-runs?per_page=2&page=1";
    const jobsPath = "/repos/acme/widgets/actions/runs/202/jobs?per_page=2&page=1";
    const logPath = "/repos/acme/widgets/actions/jobs/404/logs";

    client.enqueueJson(checkRunsPath, {
      check_runs: [
        {
          id: 201,
          name: "build",
          status: "completed",
          conclusion: "failure",
          app: { slug: "github-actions" },
          details_url: "https://github.com/acme/widgets/actions/runs/202",
          html_url: "https://github.com/acme/widgets/actions/runs/202"
        }
      ]
    });
    client.enqueueJson(jobsPath, {
      jobs: [
        {
          id: 404,
          name: "build",
          status: "completed",
          conclusion: "failure",
          check_run_url: "https://api.github.com/repos/acme/widgets/check-runs/201"
        }
      ]
    });
    client.enqueueText(logPath, "build failed\n");

    const artifact = await createFetcher(client).fetchFailedCiLogs({
      reviewRunId: "run-2",
      owner: "acme",
      repo: "widgets",
      pullRequestNumber: 18,
      headSha: "head456"
    });

    expect(artifact.logs).toEqual([
      expect.objectContaining({
        checkRunId: 201,
        workflowRunId: 202,
        workflowJobId: 404,
        content: "build failed\n"
      })
    ]);
    expect(artifact.unavailableLogs).toEqual([]);
    expect(client.requests.map((request) => request.path)).toEqual([checkRunsPath, jobsPath, logPath]);
  });

  it("records missing check-run permissions without throwing", async () => {
    const client = new MockGitHubCiLogRestClient();
    const checkRunsPath = "/repos/acme/widgets/commits/head789/check-runs?per_page=2&page=1";

    client.enqueueJson(checkRunsPath, new GitHubApiError("forbidden", 403));

    const artifact = await createFetcher(client).fetchFailedCiLogs({
      reviewRunId: "run-3",
      owner: "acme",
      repo: "widgets",
      pullRequestNumber: 19,
      headSha: "head789"
    });

    expect(artifact.checkRuns).toEqual([]);
    expect(artifact.logs).toEqual([]);
    expect(artifact.unavailableLogs).toEqual([
      {
        checkRunId: null,
        name: null,
        reason: "missing_checks_permission",
        detail: "GitHub returned 403 while listing check runs."
      }
    ]);
  });

  it("records unavailable Actions logs with a stable reason", async () => {
    const client = new MockGitHubCiLogRestClient();
    const checkRunsPath = "/repos/acme/widgets/commits/head999/check-runs?per_page=2&page=1";
    const logPath = "/repos/acme/widgets/actions/jobs/505/logs";

    client.enqueueJson(checkRunsPath, {
      check_runs: [
        {
          id: 301,
          name: "deploy",
          status: "completed",
          conclusion: "failure",
          app: { slug: "github-actions" },
          details_url: "https://github.com/acme/widgets/actions/runs/606/job/505"
        }
      ]
    });
    client.enqueueText(logPath, new GitHubApiError("forbidden", 403));

    const artifact = await createFetcher(client).fetchFailedCiLogs({
      reviewRunId: "run-4",
      owner: "acme",
      repo: "widgets",
      pullRequestNumber: 20,
      headSha: "head999"
    });

    expect(artifact.logs).toEqual([]);
    expect(artifact.unavailableLogs).toEqual([
      {
        checkRunId: 301,
        name: "deploy",
        reason: "missing_actions_permission",
        detail: "GitHub returned 403 while fetching Actions logs."
      }
    ]);
  });

  it("records non-Actions check runs as unavailable logs", async () => {
    const client = new MockGitHubCiLogRestClient();
    const checkRunsPath = "/repos/acme/widgets/commits/head321/check-runs?per_page=2&page=1";

    client.enqueueJson(checkRunsPath, {
      check_runs: [
        {
          id: 401,
          name: "external-ci",
          status: "completed",
          conclusion: "failure",
          app: { slug: "external-ci" },
          details_url: "https://ci.example.com/build/1"
        }
      ]
    });

    const artifact = await createFetcher(client).fetchFailedCiLogs({
      reviewRunId: "run-5",
      owner: "acme",
      repo: "widgets",
      pullRequestNumber: 21,
      headSha: "head321"
    });

    expect(artifact.logs).toEqual([]);
    expect(artifact.unavailableLogs).toEqual([
      {
        checkRunId: 401,
        name: "external-ci",
        reason: "not_github_actions",
        detail: "Check run was not produced by GitHub Actions."
      }
    ]);
  });
});

describe("CI log sanitization", () => {
  it("redacts common secret forms before logs can be stored or sent to an LLM", () => {
    const redacted = redactCiLogSecrets(
      [
        "Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
        "AWS_ACCESS_KEY_ID=AKIA1234567890ABCDEF",
        "password='super-secret'",
        "github_token=github_pat_1234567890abcdefghijklmnopqrstuv"
      ].join("\n")
    );

    expect(redacted).toContain("Authorization: Bearer [REDACTED_SECRET]");
    expect(redacted).not.toContain("AKIA1234567890ABCDEF");
    expect(redacted).not.toContain("super-secret");
    expect(redacted).not.toContain("github_pat_1234567890");
  });

  it("truncates logs to the configured byte budget while preserving head and tail context", () => {
    const truncated = truncateCiLogContent(`start\n${"x".repeat(200)}\nend`, 80);

    expect(truncated.truncated).toBe(true);
    expect(Buffer.byteLength(truncated.content, "utf8")).toBeLessThanOrEqual(80);
    expect(truncated.content).toContain("start");
    expect(truncated.content).toContain("end");
    expect(truncated.content).toContain("Firmcode truncated CI log");
  });

  it("reports redaction and truncation metadata for sanitized logs", () => {
    const sanitized = sanitizeCiLogContent(`first\nTOKEN=shhhhhhsecret\n${"z".repeat(160)}\nlast`, 140);

    expect(sanitized.redacted).toBe(true);
    expect(sanitized.truncated).toBe(true);
    expect(sanitized.content).toContain("[REDACTED_SECRET]");
    expect(sanitized.content).not.toContain("shhhhhhsecret");
    expect(sanitized.storedBytes).toBeLessThanOrEqual(140);
    expect(sanitized.originalBytes).toBeGreaterThan(sanitized.storedBytes);
  });
});

describe("GitHubCiLogFetchRestClient", () => {
  it("uses the GitHub API media headers for JSON and text requests", async () => {
    const originalFetch = global.fetch;
    const requests: string[] = [];

    global.fetch = (async (request: RequestInfo | URL, _init?: RequestInit) => {
      requests.push(String(request));
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    try {
      const client = new GitHubCiLogFetchRestClient("token", "https://api.github.test");

      await client.requestJson({ path: "/repos/acme/widgets/check-runs" });
      await client.requestText({ path: "/repos/acme/widgets/actions/jobs/1/logs" });

      expect(requests).toEqual([
        "https://api.github.test/repos/acme/widgets/check-runs",
        "https://api.github.test/repos/acme/widgets/actions/jobs/1/logs"
      ]);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
