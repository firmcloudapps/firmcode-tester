import {
  GitHubApiError,
  GitHubPullRequestFileFetcher,
  type GitHubRestClient,
  type GitHubRestRequest
} from "../../../src/infrastructure/github/github-pr-file-fetcher";

class MockGitHubRestClient implements GitHubRestClient {
  readonly requests: GitHubRestRequest[] = [];
  private readonly responses = new Map<string, unknown[]>();

  enqueue(path: string, ...responses: unknown[]): void {
    this.responses.set(path, responses);
  }

  async requestJson<T>(request: GitHubRestRequest): Promise<T> {
    this.requests.push(request);
    const queuedResponses = this.responses.get(request.path);

    if (queuedResponses === undefined || queuedResponses.length === 0) {
      throw new Error(`No mock response queued for ${request.path}`);
    }

    const response = queuedResponses.shift();

    if (response instanceof Error) {
      throw response;
    }

    return response as T;
  }
}

function base64(value: string | Buffer): string {
  return Buffer.from(value).toString("base64");
}

function createFetcher(client: GitHubRestClient, maxContentBytes = 500_000): GitHubPullRequestFileFetcher {
  return new GitHubPullRequestFileFetcher(client, {
    perPage: 2,
    maxContentBytes,
    maxRetries: 2,
    retryDelayMs: 0
  });
}

describe("GitHubPullRequestFileFetcher", () => {
  it("fetches pull request files across paginated GitHub responses", async () => {
    const client = new MockGitHubRestClient();
    const pageOnePath = "/repos/acme/widgets/pulls/17/files?per_page=2&page=1";
    const pageTwoPath = "/repos/acme/widgets/pulls/17/files?per_page=2&page=2";

    client.enqueue(pageOnePath, [
      {
        filename: "src/index.ts",
        status: "modified",
        additions: 3,
        deletions: 1,
        patch: "@@ -1 +1 @@\n-export {}\n+export const value = 1;\n"
      },
      {
        filename: "scripts/check.py",
        status: "added",
        additions: 2,
        deletions: 0,
        patch: "@@ -0,0 +1,2 @@\n+print('ok')\n"
      }
    ]);
    client.enqueue(pageTwoPath, [
      {
        filename: "config/app.yaml",
        status: "modified",
        additions: 1,
        deletions: 1,
        patch: "@@ -1 +1 @@\n-name: old\n+name: new\n"
      }
    ]);
    client.enqueue("/repos/acme/widgets/contents/src/index.ts?ref=head123", {
      type: "file",
      encoding: "base64",
      size: 23,
      content: base64("export const value = 1;\n")
    });
    client.enqueue("/repos/acme/widgets/contents/scripts/check.py?ref=head123", {
      type: "file",
      encoding: "base64",
      size: 12,
      content: base64("print('ok')\n")
    });
    client.enqueue("/repos/acme/widgets/contents/config/app.yaml?ref=head123", {
      type: "file",
      encoding: "base64",
      size: 10,
      content: base64("name: new\n")
    });

    const result = await createFetcher(client).fetchPullRequestFiles({
      owner: "acme",
      repo: "widgets",
      pullNumber: 17,
      headSha: "head123"
    });

    expect(result).toMatchObject({
      pageCount: 2,
      totalFiles: 3,
      skippedFiles: []
    });
    expect(result.files).toEqual([
      expect.objectContaining({
        path: "src/index.ts",
        status: "modified",
        additions: 3,
        deletions: 1,
        language: "typescript",
        headSha: "head123",
        content: "export const value = 1;\n"
      }),
      expect.objectContaining({
        path: "scripts/check.py",
        status: "added",
        language: "python",
        content: "print('ok')\n"
      }),
      expect.objectContaining({
        path: "config/app.yaml",
        status: "modified",
        language: "yaml",
        content: "name: new\n"
      })
    ]);
    expect(client.requests.map((request) => request.path)).toEqual([
      pageOnePath,
      pageTwoPath,
      "/repos/acme/widgets/contents/src/index.ts?ref=head123",
      "/repos/acme/widgets/contents/scripts/check.py?ref=head123",
      "/repos/acme/widgets/contents/config/app.yaml?ref=head123"
    ]);
  });

  it("records deleted, binary, unsupported, and oversized files with skip reasons", async () => {
    const client = new MockGitHubRestClient();
    const pageOnePath = "/repos/acme/widgets/pulls/18/files?per_page=2&page=1";
    const pageTwoPath = "/repos/acme/widgets/pulls/18/files?per_page=2&page=2";
    const pageThreePath = "/repos/acme/widgets/pulls/18/files?per_page=2&page=3";

    client.enqueue(pageOnePath, [
      {
        filename: "src/old.ts",
        status: "removed",
        additions: 0,
        deletions: 8,
        patch: "@@ -1,8 +0,0 @@\n-const old = true;\n"
      },
      {
        filename: "assets/logo.png",
        status: "added",
        additions: 0,
        deletions: 0,
        patch: null
      }
    ]);
    client.enqueue(pageTwoPath, [
      {
        filename: "README.md",
        status: "modified",
        additions: 4,
        deletions: 1,
        patch: "@@ -1 +1 @@\n-old\n+new\n"
      },
      {
        filename: "src/huge.ts",
        status: "modified",
        additions: 12,
        deletions: 2,
        patch: "@@ -1 +1 @@\n-old\n+new\n"
      }
    ]);
    client.enqueue(pageThreePath, []);
    client.enqueue("/repos/acme/widgets/contents/src/huge.ts?ref=head456", {
      type: "file",
      encoding: "base64",
      size: 64,
      content: base64("export const huge = 'this content exceeds the test limit';\n")
    });

    const result = await createFetcher(client, 20).fetchPullRequestFiles({
      owner: "acme",
      repo: "widgets",
      pullNumber: 18,
      headSha: "head456"
    });

    expect(result.files).toEqual([]);
    expect(result.skippedFiles).toEqual([
      expect.objectContaining({
        path: "src/old.ts",
        reason: "deleted",
        deletions: 8,
        sizeBytes: null,
        excludedFromSemgrep: true,
        excludedFromTreeSitter: true,
        excludedFromLlmContext: true
      }),
      expect.objectContaining({
        path: "assets/logo.png",
        reason: "binary",
        patch: null,
        sizeBytes: null
      }),
      expect.objectContaining({
        path: "README.md",
        reason: "unsupported",
        sizeBytes: null
      }),
      expect.objectContaining({
        path: "src/huge.ts",
        reason: "oversized",
        sizeBytes: 64
      })
    ]);
    expect(client.requests.map((request) => request.path)).toEqual([
      pageOnePath,
      pageTwoPath,
      pageThreePath,
      "/repos/acme/widgets/contents/src/huge.ts?ref=head456"
    ]);
  });

  it("retries transient GitHub failures for file list and content requests", async () => {
    const client = new MockGitHubRestClient();
    const pageOnePath = "/repos/acme/widgets/pulls/19/files?per_page=2&page=1";
    const contentPath = "/repos/acme/widgets/contents/src/retry.ts?ref=head789";

    client.enqueue(
      pageOnePath,
      new GitHubApiError("GitHub is unavailable", 502),
      [
        {
          filename: "src/retry.ts",
          status: "modified",
          additions: 1,
          deletions: 1,
          patch: "@@ -1 +1 @@\n-old\n+new\n"
        }
      ]
    );
    client.enqueue(
      contentPath,
      new GitHubApiError("rate limited", 429),
      {
        type: "file",
        encoding: "base64",
        size: 18,
        content: base64("export const ok = 1;\n")
      }
    );

    const result = await createFetcher(client).fetchPullRequestFiles({
      owner: "acme",
      repo: "widgets",
      pullNumber: 19,
      headSha: "head789"
    });

    expect(result.files).toEqual([
      expect.objectContaining({
        path: "src/retry.ts",
        content: "export const ok = 1;\n"
      })
    ]);
    expect(client.requests.map((request) => request.path)).toEqual([pageOnePath, pageOnePath, contentPath, contentPath]);
  });

  it("attaches persisted risk metadata to fetched and skipped changed files", async () => {
    const client = new MockGitHubRestClient();
    const pageOnePath = "/repos/acme/widgets/pulls/20/files?per_page=2&page=1";
    const pageTwoPath = "/repos/acme/widgets/pulls/20/files?per_page=2&page=2";
    const contentPath = "/repos/acme/widgets/contents/src/auth/session.ts?ref=head999";

    client.enqueue(pageOnePath, [
      {
        filename: "src/auth/session.ts",
        status: "modified",
        additions: 1,
        deletions: 0,
        patch: "@@ -1 +1,2 @@\n export function validate() {}\n+const ok = jwt.verify(token, key);\n"
      },
      {
        filename: ".env.production",
        status: "modified",
        additions: 1,
        deletions: 1,
        patch: "@@ -1 +1 @@\n-API_KEY=old\n+API_KEY=sk_live_example\n"
      }
    ]);
    client.enqueue(pageTwoPath, []);
    client.enqueue(contentPath, {
      type: "file",
      encoding: "base64",
      size: 55,
      content: base64("export function validate() {}\nconst ok = jwt.verify(token, key);\n")
    });

    const result = await createFetcher(client).fetchPullRequestFiles({
      owner: "acme",
      repo: "widgets",
      pullNumber: 20,
      headSha: "head999"
    });

    expect(result.files).toEqual([
      expect.objectContaining({
        path: "src/auth/session.ts",
        risk: expect.objectContaining({
          flags: ["auth"],
          level: "high",
          isInfrastructure: false
        })
      })
    ]);
    expect(result.skippedFiles).toEqual([
      expect.objectContaining({
        path: ".env.production",
        reason: "unsupported",
        risk: expect.objectContaining({
          flags: ["secrets"],
          level: "high"
        })
      })
    ]);
  });
});
