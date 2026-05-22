export type UnifiedDiffFileStatus = "added" | "deleted" | "modified" | "renamed" | "copied" | "unknown";

export type UnifiedDiffLineType = "context" | "addition" | "deletion" | "no_newline";

export interface UnifiedDiffLineMapping {
  readonly type: Exclude<UnifiedDiffLineType, "no_newline">;
  readonly oldLineNumber: number | null;
  readonly newLineNumber: number | null;
}

export interface UnifiedDiffHunkLine {
  readonly type: UnifiedDiffLineType;
  readonly content: string;
  readonly oldLineNumber: number | null;
  readonly newLineNumber: number | null;
}

export interface UnifiedDiffHunk {
  readonly oldStart: number;
  readonly oldLineCount: number;
  readonly newStart: number;
  readonly newLineCount: number;
  readonly sectionHeader: string;
  readonly lines: UnifiedDiffHunkLine[];
}

export interface UnifiedDiffFile {
  readonly oldPath: string | null;
  readonly newPath: string | null;
  readonly status: UnifiedDiffFileStatus;
  readonly hunks: UnifiedDiffHunk[];
  readonly changedNewLines: number[];
  readonly lineMappings: UnifiedDiffLineMapping[];
}

export interface UnifiedDiff {
  readonly files: UnifiedDiffFile[];
}

export interface ParseUnifiedDiffOptions {
  readonly path?: string;
  readonly previousPath?: string | null;
  readonly status?: UnifiedDiffFileStatus;
}

export interface InlineFindingLocation {
  readonly path: string;
  readonly line: number;
}

interface MutableUnifiedDiffFile {
  oldPath: string | null;
  newPath: string | null;
  explicitStatus: UnifiedDiffFileStatus | null;
  hunks: MutableUnifiedDiffHunk[];
  changedNewLines: Set<number>;
  lineMappings: UnifiedDiffLineMapping[];
}

interface MutableUnifiedDiffHunk {
  oldStart: number;
  oldLineCount: number;
  newStart: number;
  newLineCount: number;
  sectionHeader: string;
  lines: UnifiedDiffHunkLine[];
}

const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;

export function parseUnifiedDiff(patchText: string, options: ParseUnifiedDiffOptions = {}): UnifiedDiff {
  const files: UnifiedDiffFile[] = [];
  const lines = splitPatchLines(patchText);
  let currentFile: MutableUnifiedDiffFile | null = null;
  let currentHunk: MutableUnifiedDiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  const ensureFile = (): MutableUnifiedDiffFile => {
    currentFile ??= createMutableFile(options);
    return currentFile;
  };

  const finalizeCurrentFile = (): void => {
    if (currentFile === null) {
      return;
    }

    files.push(finalizeFile(currentFile));
    currentFile = null;
    currentHunk = null;
  };

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      finalizeCurrentFile();
      currentFile = createMutableFile(options);
      applyDiffGitHeader(currentFile, line);
      continue;
    }

    if (currentHunk === null && line.startsWith("new file mode ")) {
      ensureFile().explicitStatus = "added";
      continue;
    }

    if (currentHunk === null && line.startsWith("deleted file mode ")) {
      ensureFile().explicitStatus = "deleted";
      continue;
    }

    if (currentHunk === null && line.startsWith("similarity index ")) {
      ensureFile().explicitStatus ??= "renamed";
      continue;
    }

    if (currentHunk === null && line.startsWith("rename from ")) {
      const file = ensureFile();
      file.oldPath = parseMetadataPath(line.slice("rename from ".length));
      file.explicitStatus = "renamed";
      continue;
    }

    if (currentHunk === null && line.startsWith("rename to ")) {
      const file = ensureFile();
      file.newPath = parseMetadataPath(line.slice("rename to ".length));
      file.explicitStatus = "renamed";
      continue;
    }

    if (currentHunk === null && line.startsWith("copy from ")) {
      const file = ensureFile();
      file.oldPath = parseMetadataPath(line.slice("copy from ".length));
      file.explicitStatus = "copied";
      continue;
    }

    if (currentHunk === null && line.startsWith("copy to ")) {
      const file = ensureFile();
      file.newPath = parseMetadataPath(line.slice("copy to ".length));
      file.explicitStatus = "copied";
      continue;
    }

    if (currentHunk === null && line.startsWith("--- ")) {
      ensureFile().oldPath = parseDiffPath(line.slice("--- ".length));
      continue;
    }

    if (currentHunk === null && line.startsWith("+++ ")) {
      ensureFile().newPath = parseDiffPath(line.slice("+++ ".length));
      continue;
    }

    const hunkHeader = HUNK_HEADER_PATTERN.exec(line);

    if (hunkHeader !== null) {
      const file = ensureFile();
      currentHunk = {
        oldStart: Number(hunkHeader[1]),
        oldLineCount: readDiffLineCount(hunkHeader[2]),
        newStart: Number(hunkHeader[3]),
        newLineCount: readDiffLineCount(hunkHeader[4]),
        sectionHeader: hunkHeader[5] ?? "",
        lines: []
      };
      file.hunks.push(currentHunk);
      oldLine = currentHunk.oldStart;
      newLine = currentHunk.newStart;
      continue;
    }

    if (currentFile === null || currentHunk === null) {
      continue;
    }

    if (line.startsWith("\\ ")) {
      currentHunk.lines.push({
        type: "no_newline",
        content: line.slice(2),
        oldLineNumber: null,
        newLineNumber: null
      });
      continue;
    }

    const marker = line[0];
    const content = line.slice(1);

    if (marker === "+") {
      currentHunk.lines.push({
        type: "addition",
        content,
        oldLineNumber: null,
        newLineNumber: newLine
      });
      currentFile.changedNewLines.add(newLine);
      currentFile.lineMappings.push({
        type: "addition",
        oldLineNumber: null,
        newLineNumber: newLine
      });
      newLine += 1;
      continue;
    }

    if (marker === "-") {
      currentHunk.lines.push({
        type: "deletion",
        content,
        oldLineNumber: oldLine,
        newLineNumber: null
      });
      currentFile.lineMappings.push({
        type: "deletion",
        oldLineNumber: oldLine,
        newLineNumber: null
      });
      oldLine += 1;
      continue;
    }

    if (marker === " ") {
      currentHunk.lines.push({
        type: "context",
        content,
        oldLineNumber: oldLine,
        newLineNumber: newLine
      });
      currentFile.lineMappings.push({
        type: "context",
        oldLineNumber: oldLine,
        newLineNumber: newLine
      });
      oldLine += 1;
      newLine += 1;
    }
  }

  finalizeCurrentFile();

  return { files };
}

export function isChangedNewSideLine(file: UnifiedDiffFile, line: number): boolean {
  return Number.isInteger(line) && line > 0 && file.changedNewLines.includes(line);
}

export function canPostInlineGitHubComment(diff: UnifiedDiff, finding: InlineFindingLocation): boolean {
  const file = diff.files.find((candidate) => candidate.newPath === finding.path);

  if (file === undefined || file.newPath === null) {
    return false;
  }

  return isChangedNewSideLine(file, finding.line);
}

function splitPatchLines(patchText: string): string[] {
  const lines = patchText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  if (lines.at(-1) === "") {
    return lines.slice(0, -1);
  }

  return lines;
}

function createMutableFile(options: ParseUnifiedDiffOptions): MutableUnifiedDiffFile {
  const oldPath =
    options.previousPath !== undefined ? options.previousPath : options.status === "added" ? null : options.path ?? null;
  const newPath = options.status === "deleted" ? null : options.path ?? null;

  return {
    oldPath,
    newPath,
    explicitStatus: options.status ?? null,
    hunks: [],
    changedNewLines: new Set<number>(),
    lineMappings: []
  };
}

function finalizeFile(file: MutableUnifiedDiffFile): UnifiedDiffFile {
  return {
    oldPath: file.oldPath,
    newPath: file.newPath,
    status: file.explicitStatus ?? inferStatus(file.oldPath, file.newPath),
    hunks: file.hunks.map((hunk) => ({
      oldStart: hunk.oldStart,
      oldLineCount: hunk.oldLineCount,
      newStart: hunk.newStart,
      newLineCount: hunk.newLineCount,
      sectionHeader: hunk.sectionHeader,
      lines: hunk.lines
    })),
    changedNewLines: [...file.changedNewLines].sort((left, right) => left - right),
    lineMappings: file.lineMappings
  };
}

function applyDiffGitHeader(file: MutableUnifiedDiffFile, line: string): void {
  const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);

  if (match === null) {
    return;
  }

  file.oldPath = unquoteGitPath(match[1]);
  file.newPath = unquoteGitPath(match[2]);
}

function readDiffLineCount(value: string | undefined): number {
  return value === undefined ? 1 : Number(value);
}

function parseDiffPath(value: string): string | null {
  const path = parseMetadataPath(value);

  if (path === "/dev/null") {
    return null;
  }

  if (path.startsWith("a/") || path.startsWith("b/")) {
    return path.slice(2);
  }

  return path;
}

function parseMetadataPath(value: string): string {
  return unquoteGitPath(value.trim());
}

function unquoteGitPath(path: string): string {
  if (!path.startsWith('"') || !path.endsWith('"')) {
    return path;
  }

  try {
    return JSON.parse(path) as string;
  } catch {
    return path.slice(1, -1);
  }
}

function inferStatus(oldPath: string | null, newPath: string | null): UnifiedDiffFileStatus {
  if (oldPath === null && newPath !== null) {
    return "added";
  }

  if (oldPath !== null && newPath === null) {
    return "deleted";
  }

  if (oldPath !== null && newPath !== null && oldPath !== newPath) {
    return "renamed";
  }

  return oldPath === null && newPath === null ? "unknown" : "modified";
}
