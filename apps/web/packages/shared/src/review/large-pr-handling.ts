import type { ChangedFileRiskClassification, ChangedFileRiskFlag } from "../risk/changed-file-risk";

export type LargePullRequestReviewMode = "normal" | "prioritized" | "summary_only";

export type LargePullRequestThresholdName =
  | "changed_files"
  | "diff_bytes"
  | "changed_lines"
  | "estimated_tokens"
  | "filtered_files"
  | "semgrep_runtime_ms";

export type ReviewFileHandling = "full" | "summarized" | "semgrep_only" | "skipped";

export type ReviewSkippedFileReason =
  | "binary"
  | "budget_exhausted"
  | "dependency_lockfile"
  | "generated"
  | "large_snapshot"
  | "minified"
  | "vendor";

export interface LargePullRequestThresholds {
  readonly maxChangedFiles: number;
  readonly maxDiffBytes: number;
  readonly maxChangedLines: number;
  readonly maxEstimatedTokens: number;
  readonly maxFilesAfterFiltering: number;
  readonly maxSemgrepRuntimeMs: number;
  readonly summaryOnlyDiffBytes: number;
  readonly summaryOnlyChangedLines: number;
  readonly summaryOnlyEstimatedTokens: number;
  readonly maxFullContextFiles: number;
}

export interface LargePullRequestReviewInput {
  readonly files: ReviewPlanChangedFile[];
  readonly semgrepFindings?: readonly ReviewPlanSemgrepFinding[];
  readonly semgrepRuntimeMs?: number | null;
  readonly thresholds?: Partial<LargePullRequestThresholds>;
}

export interface ReviewPlanChangedFile {
  readonly path: string;
  readonly previousPath: string | null;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
  readonly patch: string | null;
  readonly sizeBytes: number | null;
  readonly risk: ChangedFileRiskClassification;
  readonly binary?: boolean;
}

export interface ReviewPlanSemgrepFinding {
  readonly path: string;
  readonly severity: "info" | "warning" | "error" | "low" | "medium" | "high" | "critical";
  readonly ruleId?: string;
}

export interface LargePullRequestReviewArtifact {
  readonly schemaVersion: "large-pr-review/v1";
  readonly mode: LargePullRequestReviewMode;
  readonly isLargePullRequest: boolean;
  readonly totals: LargePullRequestTotals;
  readonly thresholdEvaluations: LargePullRequestThresholdEvaluation[];
  readonly prioritizedFiles: PrioritizedReviewFile[];
  readonly skippedFiles: ReviewSkippedFileReport[];
}

export interface LargePullRequestTotals {
  readonly changedFiles: number;
  readonly diffBytes: number;
  readonly changedLines: number;
  readonly estimatedTokens: number;
  readonly filesAfterFiltering: number;
  readonly semgrepRuntimeMs: number | null;
}

export interface LargePullRequestThresholdEvaluation {
  readonly name: LargePullRequestThresholdName;
  readonly value: number;
  readonly threshold: number;
  readonly exceeded: boolean;
}

export interface PrioritizedReviewFile {
  readonly path: string;
  readonly previousPath: string | null;
  readonly status: string;
  readonly handling: ReviewFileHandling;
  readonly priority: number;
  readonly priorityReasons: string[];
  readonly additions: number;
  readonly deletions: number;
  readonly patchBytes: number;
  readonly estimatedTokens: number;
  readonly risk: ChangedFileRiskClassification;
  readonly hasSemgrepFinding: boolean;
  readonly highestSemgrepSeverity: ReviewPlanSemgrepFinding["severity"] | null;
}

export interface ReviewSkippedFileReport {
  readonly path: string;
  readonly previousPath: string | null;
  readonly status: string;
  readonly reason: ReviewSkippedFileReason;
  readonly handling: Extract<ReviewFileHandling, "summarized" | "semgrep_only" | "skipped">;
  readonly detail: string;
  readonly additions: number;
  readonly deletions: number;
  readonly patchBytes: number;
  readonly sizeBytes: number | null;
  readonly excludedFromSemgrep: boolean;
  readonly excludedFromTreeSitter: boolean;
  readonly excludedFromLlmContext: boolean;
  readonly risk: ChangedFileRiskClassification;
}

export const DEFAULT_LARGE_PULL_REQUEST_THRESHOLDS: LargePullRequestThresholds = {
  maxChangedFiles: 100,
  maxDiffBytes: 250_000,
  maxChangedLines: 3_000,
  maxEstimatedTokens: 30_000,
  maxFilesAfterFiltering: 60,
  maxSemgrepRuntimeMs: 30_000,
  summaryOnlyDiffBytes: 750_000,
  summaryOnlyChangedLines: 10_000,
  summaryOnlyEstimatedTokens: 90_000,
  maxFullContextFiles: 30
};

const RISK_PRIORITY: ReadonlyMap<ChangedFileRiskFlag, number> = new Map([
  ["secrets", 200],
  ["auth", 180],
  ["database_migration", 160],
  ["infrastructure", 130],
  ["ci_workflow", 125],
  ["dependency", 115],
  ["public_api", 110]
]);

const SEMGREP_PRIORITY: ReadonlyMap<ReviewPlanSemgrepFinding["severity"], number> = new Map([
  ["critical", 260],
  ["high", 240],
  ["error", 220],
  ["medium", 180],
  ["warning", 150],
  ["low", 120],
  ["info", 90]
]);

const SEMGREP_SEVERITY_ORDER: readonly ReviewPlanSemgrepFinding["severity"][] = [
  "info",
  "low",
  "warning",
  "medium",
  "error",
  "high",
  "critical"
];

const VENDOR_PATH_PATTERNS: readonly RegExp[] = [
  /(^|\/)node_modules\//i,
  /(^|\/)vendor\//i,
  /(^|\/)dist\//i,
  /(^|\/)build\//i,
  /(^|\/)\.next\//i,
  /(^|\/)coverage\//i
];

const GENERATED_PATH_PATTERNS: readonly RegExp[] = [
  /(^|\/)__generated__\//i,
  /(^|\/)generated\//i,
  /(^|\/)openapi[-_]client\//i,
  /(^|\/)openapi[-_]server\//i,
  /(^|\/).*\.generated\.[a-z0-9]+$/i,
  /(^|\/).*\.graphql\.[jt]s$/i,
  /(^|\/).*\.pb\.(go|cc|swift|rb|php|h)$/i,
  /(^|\/).*_pb2\.py$/i,
  /(^|\/).*_grpc\.(py|java|cs|ts|js)$/i,
  /(^|\/).*_gen\.go$/i,
  /(^|\/).*generated\.go$/i
];

const DEPENDENCY_LOCKFILES = new Set([
  "cargo.lock",
  "composer.lock",
  "gemfile.lock",
  "go.sum",
  "package-lock.json",
  "pipfile.lock",
  "pnpm-lock.yaml",
  "poetry.lock",
  "uv.lock",
  "yarn.lock"
]);

const LARGE_SNAPSHOT_PATTERNS: readonly RegExp[] = [
  /(^|\/)__snapshots__\//i,
  /(^|\/).*\.snap$/i,
  /(^|\/).*\.snapshot$/i,
  /(^|\/).*\.golden$/i
];

const BINARY_EXTENSIONS = new Set([
  ".7z",
  ".avif",
  ".bmp",
  ".class",
  ".dll",
  ".dmg",
  ".doc",
  ".docx",
  ".exe",
  ".gif",
  ".gz",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".mov",
  ".mp3",
  ".mp4",
  ".pdf",
  ".png",
  ".so",
  ".tar",
  ".webp",
  ".xls",
  ".xlsx",
  ".zip"
]);

export function createLargePullRequestReviewArtifact(
  input: LargePullRequestReviewInput
): LargePullRequestReviewArtifact {
  const thresholds = {
    ...DEFAULT_LARGE_PULL_REQUEST_THRESHOLDS,
    ...input.thresholds
  };
  const semgrepFindingsByPath = groupSemgrepFindingsByPath(input.semgrepFindings ?? []);
  const prefiltered = input.files.map((file) => ({
    file,
    skip: classifyLowValueFile(file)
  }));
  const filesAfterFiltering = prefiltered.filter((entry) => entry.skip === null).length;
  const totals = calculateTotals(input.files, filesAfterFiltering, input.semgrepRuntimeMs ?? null);
  const thresholdEvaluations = evaluateLargePullRequestThresholds(totals, thresholds);
  const isLargePullRequest = thresholdEvaluations.some((evaluation) => evaluation.exceeded);
  const summaryOnly =
    totals.diffBytes > thresholds.summaryOnlyDiffBytes ||
    totals.changedLines > thresholds.summaryOnlyChangedLines ||
    totals.estimatedTokens > thresholds.summaryOnlyEstimatedTokens;
  const mode: LargePullRequestReviewMode = summaryOnly ? "summary_only" : isLargePullRequest ? "prioritized" : "normal";

  const skippedFiles = prefiltered
    .filter((entry): entry is { file: ReviewPlanChangedFile; skip: LowValueFileSkip } => entry.skip !== null)
    .map((entry) => toSkippedFileReport(entry.file, entry.skip));
  const eligibleFiles = prefiltered
    .filter((entry) => entry.skip === null)
    .map((entry) => toPrioritizedFile(entry.file, semgrepFindingsByPath.get(entry.file.path) ?? [], mode))
    .sort(comparePrioritizedFiles);
  const budgetedFiles = applyContextBudget(eligibleFiles, thresholds.maxFullContextFiles, mode);

  return {
    schemaVersion: "large-pr-review/v1",
    mode,
    isLargePullRequest,
    totals,
    thresholdEvaluations,
    prioritizedFiles: budgetedFiles.files,
    skippedFiles: [...skippedFiles, ...budgetedFiles.skippedFiles]
  };
}

export function classifyLowValueFile(file: ReviewPlanChangedFile): LowValueFileSkip | null {
  const normalizedPath = normalizePath(file.path);
  const basename = normalizedPath.split("/").at(-1) ?? normalizedPath;

  if (file.binary === true || isBinaryPath(normalizedPath)) {
    return {
      reason: "binary",
      handling: "skipped",
      detail: "binary files are excluded from static analysis and LLM context",
      excludedFromSemgrep: true
    };
  }

  if (matchesAny(normalizedPath, VENDOR_PATH_PATTERNS)) {
    return {
      reason: "vendor",
      handling: "summarized",
      detail: "vendor or build-output paths are summarized instead of sent as review context",
      excludedFromSemgrep: false
    };
  }

  if (isMinifiedPath(normalizedPath)) {
    return {
      reason: "minified",
      handling: "summarized",
      detail: "minified assets are summarized because line-level review signal is low",
      excludedFromSemgrep: false
    };
  }

  if (DEPENDENCY_LOCKFILES.has(basename)) {
    return {
      reason: "dependency_lockfile",
      handling: "summarized",
      detail: "dependency lockfiles are summarized and risk-flagged instead of fully packed",
      excludedFromSemgrep: false
    };
  }

  if (matchesAny(normalizedPath, GENERATED_PATH_PATTERNS)) {
    return {
      reason: "generated",
      handling: "summarized",
      detail: "generated files are summarized and kept eligible for deterministic secret scanning",
      excludedFromSemgrep: false
    };
  }

  if (matchesAny(normalizedPath, LARGE_SNAPSHOT_PATTERNS)) {
    return {
      reason: "large_snapshot",
      handling: "summarized",
      detail: "snapshot or golden files are summarized because review value is low",
      excludedFromSemgrep: false
    };
  }

  return null;
}

export interface LowValueFileSkip {
  readonly reason: Exclude<ReviewSkippedFileReason, "budget_exhausted">;
  readonly handling: Extract<ReviewFileHandling, "summarized" | "skipped">;
  readonly detail: string;
  readonly excludedFromSemgrep: boolean;
}

function calculateTotals(
  files: readonly ReviewPlanChangedFile[],
  filesAfterFiltering: number,
  semgrepRuntimeMs: number | null
): LargePullRequestTotals {
  const diffBytes = files.reduce((total, file) => total + byteLength(file.patch ?? ""), 0);
  const changedLines = files.reduce((total, file) => total + file.additions + file.deletions, 0);

  return {
    changedFiles: files.length,
    diffBytes,
    changedLines,
    estimatedTokens: estimateTokensFromBytes(diffBytes),
    filesAfterFiltering,
    semgrepRuntimeMs
  };
}

function evaluateLargePullRequestThresholds(
  totals: LargePullRequestTotals,
  thresholds: LargePullRequestThresholds
): LargePullRequestThresholdEvaluation[] {
  return [
    evaluateThreshold("changed_files", totals.changedFiles, thresholds.maxChangedFiles),
    evaluateThreshold("diff_bytes", totals.diffBytes, thresholds.maxDiffBytes),
    evaluateThreshold("changed_lines", totals.changedLines, thresholds.maxChangedLines),
    evaluateThreshold("estimated_tokens", totals.estimatedTokens, thresholds.maxEstimatedTokens),
    evaluateThreshold("filtered_files", totals.filesAfterFiltering, thresholds.maxFilesAfterFiltering),
    evaluateThreshold(
      "semgrep_runtime_ms",
      totals.semgrepRuntimeMs ?? 0,
      thresholds.maxSemgrepRuntimeMs
    )
  ];
}

function evaluateThreshold(
  name: LargePullRequestThresholdName,
  value: number,
  threshold: number
): LargePullRequestThresholdEvaluation {
  return {
    name,
    value,
    threshold,
    exceeded: value > threshold
  };
}

function toSkippedFileReport(file: ReviewPlanChangedFile, skip: LowValueFileSkip): ReviewSkippedFileReport {
  return {
    path: file.path,
    previousPath: file.previousPath,
    status: file.status,
    reason: skip.reason,
    handling: skip.handling,
    detail: skip.detail,
    additions: file.additions,
    deletions: file.deletions,
    patchBytes: byteLength(file.patch ?? ""),
    sizeBytes: file.sizeBytes,
    excludedFromSemgrep: skip.excludedFromSemgrep,
    excludedFromTreeSitter: true,
    excludedFromLlmContext: true,
    risk: file.risk
  };
}

function toPrioritizedFile(
  file: ReviewPlanChangedFile,
  semgrepFindings: readonly ReviewPlanSemgrepFinding[],
  mode: LargePullRequestReviewMode
): PrioritizedReviewFile {
  const semgrepSeverity = highestSemgrepSeverity(semgrepFindings);
  const riskPriority = file.risk.flags.reduce((total, flag) => total + (RISK_PRIORITY.get(flag) ?? 0), 0);
  const semgrepPriority = semgrepSeverity === null ? 0 : SEMGREP_PRIORITY.get(semgrepSeverity) ?? 0;
  const dependencyNudge = file.risk.flags.includes("dependency") ? 15 : 0;
  const priority = riskPriority + semgrepPriority + dependencyNudge;

  return {
    path: file.path,
    previousPath: file.previousPath,
    status: file.status,
    handling: mode === "summary_only" ? "summarized" : "full",
    priority,
    priorityReasons: buildPriorityReasons(file.risk.flags, semgrepSeverity),
    additions: file.additions,
    deletions: file.deletions,
    patchBytes: byteLength(file.patch ?? ""),
    estimatedTokens: estimateTokensFromBytes(byteLength(file.patch ?? "")),
    risk: file.risk,
    hasSemgrepFinding: semgrepFindings.length > 0,
    highestSemgrepSeverity: semgrepSeverity
  };
}

function applyContextBudget(
  files: readonly PrioritizedReviewFile[],
  maxFullContextFiles: number,
  mode: LargePullRequestReviewMode
): { files: PrioritizedReviewFile[]; skippedFiles: ReviewSkippedFileReport[] } {
  if (mode === "normal" || mode === "summary_only" || files.length <= maxFullContextFiles) {
    return { files: [...files], skippedFiles: [] };
  }

  const kept = files.slice(0, maxFullContextFiles);
  const skippedFiles = files.slice(maxFullContextFiles).map((file): ReviewSkippedFileReport => ({
    path: file.path,
    previousPath: file.previousPath,
    status: file.status,
    reason: "budget_exhausted",
    handling: "summarized",
    detail: "file was summarized after higher-priority files consumed the large-PR context budget",
    additions: file.additions,
    deletions: file.deletions,
    patchBytes: file.patchBytes,
    sizeBytes: null,
    excludedFromSemgrep: false,
    excludedFromTreeSitter: true,
    excludedFromLlmContext: true,
    risk: file.risk
  }));

  return { files: kept, skippedFiles };
}

function comparePrioritizedFiles(left: PrioritizedReviewFile, right: PrioritizedReviewFile): number {
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  const leftChangedLines = left.additions + left.deletions;
  const rightChangedLines = right.additions + right.deletions;

  if (leftChangedLines !== rightChangedLines) {
    return rightChangedLines - leftChangedLines;
  }

  return left.path.localeCompare(right.path);
}

function buildPriorityReasons(
  riskFlags: readonly ChangedFileRiskFlag[],
  semgrepSeverity: ReviewPlanSemgrepFinding["severity"] | null
): string[] {
  const reasons = riskFlags.map((flag) => `risk:${flag}`);

  if (semgrepSeverity !== null) {
    reasons.unshift(`semgrep:${semgrepSeverity}`);
  }

  return reasons.length > 0 ? reasons : ["changed_file"];
}

function highestSemgrepSeverity(
  findings: readonly ReviewPlanSemgrepFinding[]
): ReviewPlanSemgrepFinding["severity"] | null {
  let highest: ReviewPlanSemgrepFinding["severity"] | null = null;

  for (const finding of findings) {
    if (
      highest === null ||
      SEMGREP_SEVERITY_ORDER.indexOf(finding.severity) > SEMGREP_SEVERITY_ORDER.indexOf(highest)
    ) {
      highest = finding.severity;
    }
  }

  return highest;
}

function groupSemgrepFindingsByPath(
  findings: readonly ReviewPlanSemgrepFinding[]
): Map<string, ReviewPlanSemgrepFinding[]> {
  const grouped = new Map<string, ReviewPlanSemgrepFinding[]>();

  for (const finding of findings) {
    const existing = grouped.get(finding.path);

    if (existing === undefined) {
      grouped.set(finding.path, [finding]);
      continue;
    }

    existing.push(finding);
  }

  return grouped;
}

function isMinifiedPath(path: string): boolean {
  return /\.(?:min|bundle)\.(?:css|js|mjs|cjs)$/i.test(path);
}

function isBinaryPath(path: string): boolean {
  const extension = readExtension(path);
  return extension !== null && BINARY_EXTENSIONS.has(extension);
}

function readExtension(path: string): string | null {
  const basename = path.split("/").at(-1) ?? path;
  const dotIndex = basename.lastIndexOf(".");

  if (dotIndex <= 0) {
    return null;
  }

  return basename.slice(dotIndex).toLowerCase();
}

function estimateTokensFromBytes(bytes: number): number {
  return Math.ceil(bytes / 4);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\/+/, "").toLowerCase();
}
