import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canPostInlineGitHubComment,
  isChangedNewSideLine,
  parseUnifiedDiff,
  type UnifiedDiff
} from "../../src/diff/unified-diff";

const FIXTURE_DIR = join(__dirname, "../fixtures/unified-diff");

function readFixture(name: string): string {
  return readFileSync(join(FIXTURE_DIR, name), "utf8");
}

function readExpected(name: string): UnifiedDiff {
  return JSON.parse(readFixture(name)) as UnifiedDiff;
}

describe("parseUnifiedDiff", () => {
  it.each(["typical", "deletion", "rename", "multi-hunk", "no-newline"])(
    "matches the %s golden fixture",
    (fixtureName) => {
      const patch = readFixture(`${fixtureName}.patch`);

      expect(parseUnifiedDiff(patch)).toEqual(readExpected(`${fixtureName}.json`));
    }
  );

  it("parses bare GitHub file patch text when file metadata is supplied", () => {
    const diff = parseUnifiedDiff("@@ -0,0 +1,2 @@\n+export const one = 1;\n+export const two = 2;\n", {
      path: "src/added.ts",
      previousPath: null,
      status: "added"
    });

    expect(diff.files).toEqual([
      expect.objectContaining({
        oldPath: null,
        newPath: "src/added.ts",
        status: "added",
        changedNewLines: [1, 2],
        lineMappings: [
          { type: "addition", oldLineNumber: null, newLineNumber: 1 },
          { type: "addition", oldLineNumber: null, newLineNumber: 2 }
        ]
      })
    ]);
  });

  it("checks whether a finding is eligible for a new-side GitHub inline comment", () => {
    const diff = parseUnifiedDiff(readFixture("typical.patch"));
    const file = diff.files[0];

    expect(isChangedNewSideLine(file, 2)).toBe(true);
    expect(isChangedNewSideLine(file, 1)).toBe(false);
    expect(canPostInlineGitHubComment(diff, { path: "src/greeting.ts", line: 3 })).toBe(true);
    expect(canPostInlineGitHubComment(diff, { path: "src/greeting.ts", line: 4 })).toBe(false);
    expect(canPostInlineGitHubComment(diff, { path: "src/missing.ts", line: 3 })).toBe(false);
  });

  it("requires the head-side path for renamed file inline comments", () => {
    const diff = parseUnifiedDiff(readFixture("rename.patch"));

    expect(canPostInlineGitHubComment(diff, { path: "src/new-name.ts", line: 2 })).toBe(true);
    expect(canPostInlineGitHubComment(diff, { path: "src/old-name.ts", line: 2 })).toBe(false);
  });

  it("does not confuse changed lines that start like file headers with file headers", () => {
    const diff = parseUnifiedDiff(
      [
        "diff --git a/src/markdown.ts b/src/markdown.ts",
        "--- a/src/markdown.ts",
        "+++ b/src/markdown.ts",
        "@@ -1,2 +1,2 @@",
        " export const fence = true;",
        "---- removed heading",
        "++++ added heading"
      ].join("\n")
    );

    expect(diff.files[0]).toEqual(
      expect.objectContaining({
        oldPath: "src/markdown.ts",
        newPath: "src/markdown.ts",
        changedNewLines: [2]
      })
    );
    expect(diff.files[0].hunks[0].lines.slice(1)).toEqual([
      { type: "deletion", content: "--- removed heading", oldLineNumber: 2, newLineNumber: null },
      { type: "addition", content: "+++ added heading", oldLineNumber: null, newLineNumber: 2 }
    ]);
  });

  it("does not allow new-side inline comments on deletion-only changes", () => {
    const diff = parseUnifiedDiff(readFixture("deletion.patch"));

    expect(canPostInlineGitHubComment(diff, { path: "src/flags.ts", line: 2 })).toBe(false);
  });
});
