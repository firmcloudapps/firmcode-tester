import { generateKeyPairSync } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FIRMCODEAI_SCANNING_COMMENT_MARKER, type GitHubAppConfig } from "@firmcode/shared";
import {
  createGitHubAppJwt,
  GitHubAppPullRequestActivityPublisher
} from "../../../src/infrastructure/github/github-pr-activity-publisher";

describe("GitHubAppPullRequestActivityPublisher", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates an existing FirmcodeAI scanning activity comment", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: "installation-token" }))
      .mockResolvedValueOnce(jsonResponse([{ id: 99, body: `${FIRMCODEAI_SCANNING_COMMENT_MARKER}\nold body` }]))
      .mockResolvedValueOnce(jsonResponse({ id: 99 }));
    vi.stubGlobal("fetch", fetchMock);

    await new GitHubAppPullRequestActivityPublisher(testGitHubConfig()).publishScanningActivity({
      installationId: 101,
      repositoryFullName: "openclaw/firmcode-fixture",
      pullRequestNumber: 7,
      reviewRunId: "run-1",
      headSha: "abc123def456",
      triggerEvent: "pull_request.synchronize",
      status: "queued"
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.github.com/app/installations/101/access_tokens");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.github.com/repos/openclaw/firmcode-fixture/issues/7/comments?per_page=100"
    );
    expect(fetchMock.mock.calls[2][0]).toBe("https://api.github.com/repos/openclaw/firmcode-fixture/issues/comments/99");
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({
      body: expect.stringContaining("## FirmcodeAI Scanning")
    });
  });

  it("rejects failed GitHub activity publishing requests with a normalized error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Resource not accessible by integration" }, 403)));

    await expect(
      new GitHubAppPullRequestActivityPublisher(testGitHubConfig()).publishScanningActivity({
        installationId: 101,
        repositoryFullName: "openclaw/firmcode-fixture",
        pullRequestNumber: 7,
        reviewRunId: "run-1",
        headSha: "abc123def456",
        triggerEvent: "pull_request.opened"
      })
    ).rejects.toMatchObject({
      name: "GitHubActivityPublishError",
      status: 403,
      githubMessage: "Resource not accessible by integration",
      message: expect.stringContaining("Resource not accessible by integration")
    });
  });

  it("creates a valid three-part GitHub App JWT", () => {
    const token = createGitHubAppJwt(testGitHubConfig(), 1_700_000_000);

    expect(token.split(".")).toHaveLength(3);
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
