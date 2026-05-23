import { generateKeyPairSync } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitHubAppConfig } from "@firmcode/shared";
import {
  buildGitHubInlineReviewPayload,
  DryRunGitHubPullRequestReviewPublisher,
  GitHubAppPullRequestReviewPublisher,
  InMemoryPublishedCommentStore,
  type InlineReviewChangedLine,
  type PublishPullRequestInlineReviewCommentInput
} from "../../../src/infrastructure/github/github-pr-review-publisher";

const changedLines: InlineReviewChangedLine[] = [
  { path: "src/server.ts", line: 12 },
  { path: "src/server.ts", line: 42 },
  { path: "src/auth.ts", line: 9 },
  { path: "src/auth.ts", line: 14 }
];

describe("buildGitHubInlineReviewPayload", () => {
  it("formats review comments with severity, evidence, and actionable fixes on changed lines only", () => {
    const build = buildGitHubInlineReviewPayload({
      installationId: 101,
      repositoryFullName: "acme/widgets",
      pullRequestNumber: 7,
      reviewRunId: "run-1",
      headSha: "abc123def456",
      changedLines,
      maxInlineComments: 10,
      inlineComments: [
        comment({
          findingId: "finding-1",
          path: "src/server.ts",
          line: 42,
          title: "Shell command uses untrusted input",
          body: "The new command path passes PR-controlled input into a shell invocation.",
          severity: "high",
          confidence: 0.93,
          suggestedFix: "Validate the command against an allowlist before invoking the shell.",
          evidence: [
            {
              source: "semgrep",
              path: "src/server.ts",
              lineRange: { startLine: 42, endLine: 42 },
              excerpt: "exec(`deploy ${branch}`)"
            }
          ]
        }),
        comment({
          findingId: "finding-2",
          path: "src/server.ts",
          line: 99,
          title: "Unchanged line should not publish",
          body: "This line is outside the changed-line map.",
          severity: "critical",
          confidence: 1,
          suggestedFix: "Move this observation to the summary instead."
        })
      ]
    });

    expect(build.skippedCommentCount).toBe(1);
    expect(build.cappedCommentCount).toBe(0);
    expect(build.payload).toMatchObject({
      commit_id: "abc123def456",
      event: "COMMENT",
      comments: [
        {
          path: "src/server.ts",
          line: 42,
          side: "RIGHT"
        }
      ]
    });
    expect(build.payload?.comments[0]?.body).toContain("**Severity:** HIGH");
    expect(build.payload?.comments[0]?.body).toContain("**Evidence:**");
    expect(build.payload?.comments[0]?.body).toContain("semgrep `src/server.ts:42`");
    expect(build.payload?.comments[0]?.body).toContain("**Actionable fix:**");
    expect(build.payload?.comments[0]?.body).toContain("Validate the command against an allowlist");
  });

  it("enforces the inline cap using severity, confidence, and stable input order", () => {
    const build = buildGitHubInlineReviewPayload({
      installationId: 101,
      repositoryFullName: "acme/widgets",
      pullRequestNumber: 7,
      reviewRunId: "run-1",
      headSha: "abc123def456",
      changedLines,
      maxInlineComments: 3,
      inlineComments: [
        comment({ findingId: "low", severity: "low", confidence: 1, path: "src/server.ts", line: 12 }),
        comment({ findingId: "high-low-confidence", severity: "high", confidence: 0.5, path: "src/server.ts", line: 42 }),
        comment({ findingId: "medium", severity: "medium", confidence: 1, path: "src/auth.ts", line: 9 }),
        comment({ findingId: "critical", severity: "critical", confidence: 0.2, path: "src/auth.ts", line: 14 }),
        comment({ findingId: "high-high-confidence", severity: "high", confidence: 0.9, path: "src/server.ts", line: 12 })
      ]
    });

    expect(build.cappedCommentCount).toBe(2);
    expect(build.selectedComments.map((selected) => selected.findingId)).toEqual([
      "critical",
      "high-high-confidence",
      "high-low-confidence"
    ]);
    expect(build.payload?.comments).toHaveLength(3);
  });
});

describe("GitHubAppPullRequestReviewPublisher", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts a GitHub review and persists returned inline comment ids", async () => {
    const store = new InMemoryPublishedCommentStore();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: "installation-token" }))
      .mockResolvedValueOnce(jsonResponse({ id: 555 }))
      .mockImplementationOnce(async (_url: string, _init: RequestInit) => {
        const postedReview = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as {
          comments: Array<{ path: string; line: number; body: string }>;
        };

        return jsonResponse([
          {
            id: 9001,
            path: postedReview.comments[0]?.path,
            line: postedReview.comments[0]?.line,
            body: postedReview.comments[0]?.body
          }
        ]);
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new GitHubAppPullRequestReviewPublisher(testGitHubConfig(), store).publishInlineReview({
      installationId: 101,
      repositoryFullName: "openclaw/firmcode-fixture",
      pullRequestNumber: 7,
      reviewRunId: "00000000-0000-4000-8000-000000000010",
      headSha: "abc123def456",
      changedLines,
      maxInlineComments: 1,
      inlineComments: [
        comment({
          findingId: "00000000-0000-4000-8000-000000000020",
          path: "src/server.ts",
          line: 42,
          severity: "high",
          confidence: 0.98
        })
      ]
    });

    expect(result).toMatchObject({
      reviewId: 555,
      selectedCommentCount: 1,
      publishedComments: [
        {
          findingId: "00000000-0000-4000-8000-000000000020",
          githubCommentId: 9001,
          filePath: "src/server.ts",
          line: 42
        }
      ]
    });
    expect(store.inlineComments).toEqual(result.publishedComments);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.github.com/repos/openclaw/firmcode-fixture/pulls/7/reviews"
    );
    expect(fetchMock.mock.calls[2][0]).toBe(
      "https://api.github.com/repos/openclaw/firmcode-fixture/pulls/7/reviews/555/comments?per_page=100"
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      commit_id: "abc123def456",
      event: "COMMENT",
      comments: [
        {
          path: "src/server.ts",
          line: 42,
          side: "RIGHT",
          body: expect.stringContaining("**Actionable fix:**")
        }
      ]
    });
  });

  it("persists would-be inline comments without GitHub write calls in dry run", async () => {
    const store = new InMemoryPublishedCommentStore();
    const fetchMock = vi.fn();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);

    const result = await new DryRunGitHubPullRequestReviewPublisher(store).publishInlineReview({
      installationId: 101,
      repositoryFullName: "openclaw/firmcode-fixture",
      pullRequestNumber: 7,
      reviewRunId: "00000000-0000-4000-8000-000000000010",
      headSha: "abc123def456",
      changedLines,
      maxInlineComments: 1,
      inlineComments: [
        comment({
          findingId: "00000000-0000-4000-8000-000000000020",
          path: "src/server.ts",
          line: 42,
          severity: "high",
          confidence: 0.98
        })
      ]
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      reviewId: null,
      selectedCommentCount: 1,
      publishedComments: [
        {
          githubReviewId: null,
          githubCommentId: null,
          dryRun: true,
          filePath: "src/server.ts",
          line: 42,
          body: expect.stringContaining("**Severity:** HIGH")
        }
      ]
    });
    expect(store.inlineComments).toEqual(result.publishedComments);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("\"event\":\"github.review.dry_run\""));
  });
});

function comment(
  overrides: Partial<PublishPullRequestInlineReviewCommentInput> = {}
): PublishPullRequestInlineReviewCommentInput {
  return {
    findingId: "finding-id",
    path: "src/server.ts",
    line: 42,
    title: "Review finding",
    body: "A grounded issue was found on this changed line.",
    severity: "medium",
    confidence: 0.75,
    evidence: [
      {
        source: "llm",
        path: overrides.path ?? "src/server.ts",
        lineRange: { startLine: overrides.line ?? 42, endLine: overrides.line ?? 42 },
        excerpt: "changed line evidence"
      }
    ],
    suggestedFix: "Apply the smallest fix that removes the risky behavior.",
    ...overrides
  };
}

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
