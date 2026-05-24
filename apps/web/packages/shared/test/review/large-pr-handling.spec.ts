import { describe, expect, it } from "vitest";
import {
  classifyChangedFileRisk,
  createLargePullRequestReviewArtifact,
  DEFAULT_LARGE_PULL_REQUEST_THRESHOLDS,
  type ReviewPlanChangedFile
} from "../../src";

function changedFile(
  path: string,
  patch: string,
  overrides: Partial<ReviewPlanChangedFile> = {}
): ReviewPlanChangedFile {
  return {
    path,
    previousPath: null,
    status: "modified",
    additions: countPatchLines(patch, "+"),
    deletions: countPatchLines(patch, "-"),
    patch,
    sizeBytes: patch.length,
    risk: classifyChangedFileRisk({ path, patch }),
    ...overrides
  };
}

function countPatchLines(patch: string, marker: "+" | "-"): number {
  return patch
    .split("\n")
    .filter((line) => line.startsWith(marker) && !line.startsWith(`${marker}${marker}${marker}`)).length;
}

function patchWithAddedLines(lineCount: number): string {
  const lines = ["@@ -0,0 +1," + lineCount + " @@"];

  for (let index = 0; index < lineCount; index += 1) {
    lines.push(`+export const value${index} = ${index};`);
  }

  return lines.join("\n");
}

describe("createLargePullRequestReviewArtifact", () => {
  it("enters summary-only mode for a huge diff and records threshold evidence", () => {
    const artifact = createLargePullRequestReviewArtifact({
      files: [changedFile("apps/api/src/controllers/users.ts", patchWithAddedLines(120))],
      thresholds: {
        maxChangedFiles: 50,
        maxDiffBytes: 100,
        maxChangedLines: 100,
        maxEstimatedTokens: 20,
        summaryOnlyDiffBytes: 200,
        summaryOnlyChangedLines: 110,
        summaryOnlyEstimatedTokens: 50
      }
    });

    expect(artifact.mode).toBe("summary_only");
    expect(artifact.isLargePullRequest).toBe(true);
    expect(artifact.thresholdEvaluations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "diff_bytes", exceeded: true }),
        expect.objectContaining({ name: "changed_lines", exceeded: true }),
        expect.objectContaining({ name: "estimated_tokens", exceeded: true })
      ])
    );
    expect(artifact.prioritizedFiles).toEqual([
      expect.objectContaining({
        path: "apps/api/src/controllers/users.ts",
        handling: "summarized"
      })
    ]);
  });

  it("enters prioritized mode for many files and keeps high-risk files within the context budget", () => {
    const files = [
      changedFile("apps/api/src/util/a.ts", "+export const a = 1;"),
      changedFile("apps/api/src/auth/session.ts", "+const ok = jwt.verify(token, key);"),
      changedFile("infra/docker/api.Dockerfile", "+FROM node:22-alpine"),
      changedFile("apps/api/src/util/b.ts", "+export const b = 2;"),
      changedFile("apps/api/src/routes/users.ts", "+export function listUsers() {}")
    ];

    const artifact = createLargePullRequestReviewArtifact({
      files,
      thresholds: {
        maxChangedFiles: 3,
        maxFilesAfterFiltering: 3,
        maxFullContextFiles: 2,
        summaryOnlyChangedLines: 1_000
      }
    });

    expect(artifact.mode).toBe("prioritized");
    expect(artifact.prioritizedFiles.map((file) => file.path)).toEqual([
      "apps/api/src/auth/session.ts",
      "infra/docker/api.Dockerfile"
    ]);
    expect(artifact.skippedFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "apps/api/src/routes/users.ts",
          reason: "budget_exhausted",
          excludedFromSemgrep: false,
          excludedFromLlmContext: true
        })
      ])
    );
  });

  it("summarizes generated, vendor, minified, lockfile, and binary files with explicit reasons", () => {
    const artifact = createLargePullRequestReviewArtifact({
      files: [
        changedFile("node_modules/lib/index.js", "+module.exports = {};"),
        changedFile("apps/web/__generated__/api.generated.ts", "+export type User = {};"),
        changedFile("apps/web/public/app.min.js", "+function x(){}"),
        changedFile("package-lock.json", "+  \"packages\": {}"),
        changedFile("assets/logo.png", "", { binary: true, additions: 0, deletions: 0, patch: null, sizeBytes: 2048 })
      ]
    });

    expect(artifact.skippedFiles).toEqual([
      expect.objectContaining({
        path: "node_modules/lib/index.js",
        reason: "vendor",
        handling: "summarized",
        excludedFromSemgrep: false
      }),
      expect.objectContaining({
        path: "apps/web/__generated__/api.generated.ts",
        reason: "generated",
        handling: "summarized",
        excludedFromSemgrep: false
      }),
      expect.objectContaining({
        path: "apps/web/public/app.min.js",
        reason: "minified",
        handling: "summarized",
        excludedFromSemgrep: false
      }),
      expect.objectContaining({
        path: "package-lock.json",
        reason: "dependency_lockfile",
        handling: "summarized",
        risk: expect.objectContaining({ flags: ["dependency"] })
      }),
      expect.objectContaining({
        path: "assets/logo.png",
        reason: "binary",
        handling: "skipped",
        excludedFromSemgrep: true
      })
    ]);
  });

  it("prioritizes a large PR file with a Semgrep finding even when its path risk is low", () => {
    const files = [
      changedFile("apps/api/src/util/math.ts", "+export const unsafe = input;"),
      changedFile("apps/api/src/routes/users.ts", "+export function createUser() {}"),
      changedFile("apps/api/src/util/format.ts", "+export const label = 'ok';")
    ];

    const artifact = createLargePullRequestReviewArtifact({
      files,
      semgrepFindings: [
        {
          path: "apps/api/src/util/math.ts",
          severity: "high",
          ruleId: "typescript.express.security.audit"
        }
      ],
      thresholds: {
        maxChangedFiles: 2,
        maxFullContextFiles: 1
      }
    });

    expect(artifact.mode).toBe("prioritized");
    expect(artifact.prioritizedFiles).toEqual([
      expect.objectContaining({
        path: "apps/api/src/util/math.ts",
        hasSemgrepFinding: true,
        highestSemgrepSeverity: "high",
        priorityReasons: expect.arrayContaining(["semgrep:high"])
      })
    ]);
    expect(artifact.skippedFiles.map((file) => file.path)).toContain("apps/api/src/routes/users.ts");
  });

  it("can trigger large-PR mode from Semgrep runtime budget alone", () => {
    const artifact = createLargePullRequestReviewArtifact({
      files: [changedFile("apps/api/src/util/math.ts", "+export const value = 1;")],
      semgrepRuntimeMs: DEFAULT_LARGE_PULL_REQUEST_THRESHOLDS.maxSemgrepRuntimeMs + 1
    });

    expect(artifact.mode).toBe("prioritized");
    expect(artifact.thresholdEvaluations).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "semgrep_runtime_ms", exceeded: true })])
    );
  });
});
