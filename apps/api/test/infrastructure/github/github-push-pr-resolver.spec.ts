import { generateKeyPairSync } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitHubAppConfig } from "@firmcode/shared";
import { GitHubAppPushPullRequestResolver } from "../../../src/infrastructure/github/github-push-pr-resolver";

describe("GitHubAppPushPullRequestResolver", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists pull requests associated with a pushed commit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: "installation-token" }))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 303,
            number: 7,
            title: "Add webhook normalization",
            state: "open",
            draft: false,
            user: { login: "octocat" },
            base: { ref: "main", sha: "base123" },
            head: { ref: "feature/webhooks", sha: "fed456cba123" }
          }
        ])
      );
    vi.stubGlobal("fetch", fetchMock);

    const pullRequests = await new GitHubAppPushPullRequestResolver(testGitHubConfig()).resolveAssociatedPullRequests({
      installationId: 101,
      repositoryFullName: "openclaw/firmcode-fixture",
      commitSha: "fed456cba123"
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.github.com/app/installations/101/access_tokens");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.github.com/repos/openclaw/firmcode-fixture/commits/fed456cba123/pulls?per_page=100"
    );
    expect(pullRequests).toEqual([
      {
        githubPullRequestId: 303,
        number: 7,
        title: "Add webhook normalization",
        authorLogin: "octocat",
        baseRef: "main",
        headRef: "feature/webhooks",
        baseSha: "base123",
        headSha: "fed456cba123",
        state: "open",
        draft: false
      }
    ]);
  });

  it("rejects GitHub API failures with a normalized error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Resource not accessible by integration" }, 403)));

    await expect(
      new GitHubAppPushPullRequestResolver(testGitHubConfig()).resolveAssociatedPullRequests({
        installationId: 101,
        repositoryFullName: "openclaw/firmcode-fixture",
        commitSha: "fed456cba123"
      })
    ).rejects.toMatchObject({
      name: "GitHubPushPullRequestResolutionError",
      status: 403,
      githubMessage: "Resource not accessible by integration",
      message: expect.stringContaining("Resource not accessible by integration")
    });
  });
});

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function testGitHubConfig(): GitHubAppConfig {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "pkcs1", format: "pem" }
  });

  return {
    appId: 12345,
    privateKey,
    webhookSecret: "secret",
    clientId: "client",
    clientSecret: "client-secret",
    redacted: {
      appId: "REDACTED",
      privateKey: "REDACTED",
      webhookSecret: "REDACTED",
      clientId: "REDACTED",
      clientSecret: "REDACTED"
    },
    toJSON() {
      return this.redacted;
    }
  };
}
