import type { FindingsListResponse } from "@firmcode/shared";
import { loadFindingsState } from "../lib/dashboard-data";

describe("dashboard findings data loader", () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    vi.unstubAllGlobals();
  });

  it("maps every findings filter into the API query string", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://dashboard-api.test";
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(findingsResponse));

    vi.stubGlobal("fetch", fetcher);

    await expect(
      loadFindingsState({
        severity: "high",
        source: "semgrep",
        category: "security",
        repository: "openclaw/firmcode",
        repositoryId: "repo-1",
        status: "posted",
        postedInline: "true",
        dateFrom: "2026-05-22",
        dateTo: "2026-05-23"
      })
    ).resolves.toMatchObject({ status: "populated" });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));

    expect(url.pathname).toBe("/api/findings");
    expect(url.searchParams.get("severity")).toBe("high");
    expect(url.searchParams.get("source")).toBe("semgrep");
    expect(url.searchParams.get("category")).toBe("security");
    expect(url.searchParams.get("repository")).toBe("openclaw/firmcode");
    expect(url.searchParams.get("repositoryId")).toBe("repo-1");
    expect(url.searchParams.get("status")).toBe("posted");
    expect(url.searchParams.get("postedInline")).toBe("true");
    expect(url.searchParams.get("dateFrom")).toBe("2026-05-22");
    expect(url.searchParams.get("dateTo")).toBe("2026-05-23");
  });
});

const findingsResponse: FindingsListResponse = {
  filters: {},
  findings: [
    {
      id: "finding-1",
      reviewRunId: "run-1",
      repositoryId: "repo-1",
      repositoryFullName: "openclaw/firmcode",
      pullRequestNumber: 7,
      pullRequestTitle: "Add findings inbox",
      source: "semgrep",
      category: "security",
      severity: "high",
      confidence: "high",
      filePath: "src/server.ts",
      startLine: 42,
      endLine: 42,
      title: "Guard repository access",
      body: "Repository access must be workspace scoped.",
      evidence: [],
      suggestion: null,
      dedupeKey: "finding-1",
      postAsInline: true,
      postedInline: true,
      status: "posted",
      semgrepRuleId: "rule.id",
      postedAt: "2026-05-22T10:01:00.000Z",
      githubCommentId: 8002,
      githubCommentUrl: "https://github.com/openclaw/firmcode/pull/7#discussion_r8002",
      reviewRunCreatedAt: "2026-05-22T10:00:00.000Z",
      createdAt: "2026-05-22T10:00:00.000Z"
    }
  ]
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}
