import React from "react";
import { renderToString } from "react-dom/server";
import type { CiFailureDetailResponse, CiFailureListResponse } from "@firmcode/shared";
import { CiFailureDetailView, CiFailuresView } from "../components/dashboard/ci-failures-view";

describe("CiFailuresView", () => {
  it("renders loading, empty, and error states", () => {
    expect(renderToString(<CiFailuresView state={{ status: "loading" }} />)).toContain("Loading CI failures");
    expect(renderToString(<CiFailuresView state={{ status: "empty", data: emptyCiFailures }} />)).toContain(
      "No CI failures match these filters"
    );
    expect(renderToString(<CiFailuresView state={{ status: "error", message: "API unavailable" }} />)).toContain(
      "CI failures could not be loaded"
    );
  });

  it("renders selected filters for repository, run status, flaky status, and dates", () => {
    const html = renderToString(<CiFailuresView state={{ status: "populated", data: ciFailures }} />);

    expect(html).toContain('action="/ci-failures"');
    expect(html).toContain('name="repository"');
    expect(html).toContain('value="openclaw/firmcode"');
    expect(html).toContain('name="status"');
    expect(html).toContain('value="failed" selected="">Failed');
    expect(html).toContain('name="flaky"');
    expect(html).toContain('value="true" selected="">Suspected');
    expect(html).toContain('name="dateFrom"');
    expect(html).toContain('value="2026-05-20"');
    expect(html).toContain('name="dateTo"');
    expect(html).toContain('value="2026-05-24"');
  });

  it("renders populated CI failure rows and responsive list surfaces", () => {
    const html = renderToString(<CiFailuresView state={{ status: "populated", data: ciFailures }} />);

    expect(html).toContain("Broken checks queue");
    expect(html).toContain("openclaw/firmcode");
    expect(html).toContain("Unit tests");
    expect(html).toContain("npm test");
    expect(html).toContain("AssertionError");
    expect(html).toContain("Update the API test expectation");
    expect(html).toContain('href="/ci-failures/00000000-0000-4000-8000-000000000501%3Aunit-tests"');
    expect(html).toContain("md:hidden");
    expect(html).toContain("hidden overflow-x-auto md:block");
  });
});

describe("CiFailureDetailView", () => {
  it("renders loading, empty, and error states", () => {
    expect(renderToString(<CiFailureDetailView state={{ status: "loading" }} />)).toContain("Loading CI failure detail");
    expect(renderToString(<CiFailureDetailView state={{ status: "empty" }} />)).toContain("The CI failure could not be found.");
    expect(renderToString(<CiFailureDetailView state={{ status: "error", message: "API unavailable" }} />)).toContain(
      "CI failures could not be loaded"
    );
  });

  it("renders failure summary, root cause, suggested fixes, failed jobs, and related links", () => {
    const html = renderToString(<CiFailureDetailView state={{ status: "populated", data: ciFailureDetail }} />);

    expect(html).toContain("Failure Summary");
    expect(html).toContain("Likely root cause");
    expect(html).toContain("The unit test expected HTTP 201 but the API returned 200.");
    expect(html).toContain("Suggested Fixes");
    expect(html).toContain("Update the API test expectation or restore created responses.");
    expect(html).toContain("Failed Jobs");
    expect(html).toContain("Related Links");
    expect(html).toContain('href="/review-runs/00000000-0000-4000-8000-000000000401"');
    expect(html).toContain('href="/pull-requests/pr-7"');
  });

  it("renders redacted log excerpts collapsed by default", () => {
    const html = renderToString(<CiFailureDetailView state={{ status: "populated", data: ciFailureDetail }} />);

    expect(html).toContain("Redacted Log Excerpts");
    expect(html).toContain("collapsed excerpts available by default");
    expect(html).toContain("redacted");
    expect(html).toContain("[REDACTED_SECRET]");
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
  });

  it("disables unauthorized raw artifact controls without exposing storage keys", () => {
    const viewerDetail: CiFailureDetailResponse = {
      ...ciFailureDetail,
      relatedArtifacts: ciFailureDetail.relatedArtifacts.map((artifact) => ({
        ...artifact,
        storageKey: null,
        rawAccessAllowed: false,
        rawAccessUrl: null
      }))
    };
    const html = renderToString(<CiFailureDetailView state={{ status: "populated", data: viewerDetail }} />);

    expect(html).toContain("Raw artifact restricted");
    expect(html).toContain("disabled=\"\"");
    expect(html).not.toContain("artifacts/run-401/ci-log.json");
    expect(html).not.toContain('href="/api/review-runs/00000000-0000-4000-8000-000000000401/artifacts');
  });

  it("shows raw artifact links only when the API marks access as allowed", () => {
    const html = renderToString(<CiFailureDetailView state={{ status: "populated", data: ciFailureDetail }} />);

    expect(html).toContain("Raw artifact");
    expect(html).toContain(
      'href="/api/review-runs/00000000-0000-4000-8000-000000000401/artifacts/00000000-0000-4000-8000-000000000502/raw"'
    );
    expect(html).not.toContain("raw model output");
    expect(html).not.toContain("raw Semgrep output");
  });
});

const CI_FAILURE_ID = "00000000-0000-4000-8000-000000000501:unit-tests";

const ciFailures: CiFailureListResponse = {
  filters: {
    repository: "openclaw/firmcode",
    status: "failed",
    flaky: true,
    dateFrom: "2026-05-20",
    dateTo: "2026-05-24"
  },
  pagination: {
    limit: 50,
    returned: 1
  },
  ciFailures: [
    {
      id: CI_FAILURE_ID,
      repositoryId: "repo-1",
      repositoryFullName: "openclaw/firmcode",
      pullRequestId: "pr-7",
      pullRequestNumber: 7,
      pullRequestTitle: "Add CI failure dashboard",
      reviewRunId: "00000000-0000-4000-8000-000000000401",
      failedJob: {
        id: "unit-tests",
        workflowName: "Unit tests",
        jobName: "npm test",
        checkRunId: 12345,
        conclusion: "failure",
        stepName: "Run npm test",
        category: "test",
        detailsUrl: "https://github.com/openclaw/firmcode/actions/runs/1/job/2"
      },
      rootCauseSummary: "AssertionError: expected 201 to equal 200 in the API controller spec.",
      flakySuspected: true,
      suggestedFix: "Update the API test expectation or restore created responses.",
      status: "failed",
      createdAt: "2026-05-23T10:06:00.000Z"
    }
  ]
};

const emptyCiFailures: CiFailureListResponse = {
  filters: {},
  pagination: {
    limit: 50,
    returned: 0
  },
  ciFailures: []
};

const ciFailureDetail: CiFailureDetailResponse = {
  ...ciFailures.ciFailures[0],
  rootCause: "The unit test expected HTTP 201 but the API returned 200.",
  suggestedFixes: [
    {
      id: `${CI_FAILURE_ID}:fix:1`,
      text: "Update the API test expectation or restore created responses."
    }
  ],
  failedJobs: [
    ciFailures.ciFailures[0].failedJob,
    {
      id: "lint",
      workflowName: "Unit tests",
      jobName: "npm run lint",
      checkRunId: 12346,
      conclusion: "failure",
      stepName: "TypeScript",
      category: "typecheck",
      detailsUrl: null
    }
  ],
  relatedReviewRun: {
    id: "00000000-0000-4000-8000-000000000401",
    status: "failed",
    createdAt: "2026-05-23T10:00:00.000Z",
    detailUrl: "/api/review-runs/00000000-0000-4000-8000-000000000401"
  },
  relatedArtifacts: [
    {
      id: "00000000-0000-4000-8000-000000000501",
      artifactType: "ci_failure_explanation",
      storageKey: "artifacts/run-401/ci-failure-explanation.json",
      metadata: { schemaVersion: "ci-failure-explanation/v1" },
      rawAccessAllowed: true,
      rawAccessRequiredRole: "admin",
      rawAccessUrl:
        "/api/review-runs/00000000-0000-4000-8000-000000000401/artifacts/00000000-0000-4000-8000-000000000501/raw",
      createdAt: "2026-05-23T10:06:00.000Z"
    },
    {
      id: "00000000-0000-4000-8000-000000000502",
      artifactType: "ci_log",
      storageKey: "artifacts/run-401/ci-log.json",
      metadata: { schemaVersion: "ci-log-artifact/v1", redacted: true, logsCount: 1 },
      rawAccessAllowed: true,
      rawAccessRequiredRole: "admin",
      rawAccessUrl:
        "/api/review-runs/00000000-0000-4000-8000-000000000401/artifacts/00000000-0000-4000-8000-000000000502/raw",
      createdAt: "2026-05-23T10:05:00.000Z"
    }
  ],
  logExcerpts: [
    {
      id: `${CI_FAILURE_ID}:excerpt:1`,
      source: "ci_log",
      title: "Run npm test",
      excerpt: "AssertionError: expected 201 to equal 200\nTOKEN=[REDACTED_SECRET]",
      artifactId: "00000000-0000-4000-8000-000000000502",
      storageKey: null,
      redacted: true,
      truncated: false,
      collapsed: true,
      createdAt: "2026-05-23T10:06:00.000Z"
    }
  ],
  unavailableLogNotes: []
};
