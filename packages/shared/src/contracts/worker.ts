export const WORKER_REVIEW_JOB_INPUT_SCHEMA_VERSION = "review-job-input/v1" as const;
export const WORKER_DIFF_ARTIFACT_SCHEMA_VERSION = "diff-artifact/v1" as const;
export const WORKER_SEMGREP_ARTIFACT_SCHEMA_VERSION = "semgrep-artifact/v1" as const;
export const WORKER_TREE_SITTER_ARTIFACT_SCHEMA_VERSION = "tree-sitter-artifact/v1" as const;
export const WORKER_CI_LOG_ARTIFACT_SCHEMA_VERSION = "ci-log-artifact/v1" as const;
export const WORKER_CI_FAILURE_EXPLANATION_SCHEMA_VERSION = "ci-failure-explanation/v1" as const;
export const WORKER_LLM_REVIEW_OUTPUT_SCHEMA_VERSION = "llm-review-output/v1" as const;
export const WORKER_PUBLISH_PAYLOAD_SCHEMA_VERSION = "publish-payload/v1" as const;

export const WORKER_CONTRACT_SCHEMA_VERSIONS = {
  reviewJobInput: WORKER_REVIEW_JOB_INPUT_SCHEMA_VERSION,
  diffArtifact: WORKER_DIFF_ARTIFACT_SCHEMA_VERSION,
  semgrepArtifact: WORKER_SEMGREP_ARTIFACT_SCHEMA_VERSION,
  treeSitterArtifact: WORKER_TREE_SITTER_ARTIFACT_SCHEMA_VERSION,
  ciLogArtifact: WORKER_CI_LOG_ARTIFACT_SCHEMA_VERSION,
  ciFailureExplanation: WORKER_CI_FAILURE_EXPLANATION_SCHEMA_VERSION,
  llmReviewOutput: WORKER_LLM_REVIEW_OUTPUT_SCHEMA_VERSION,
  publishPayload: WORKER_PUBLISH_PAYLOAD_SCHEMA_VERSION
} as const;

export type WorkerContractSchemaVersion =
  (typeof WORKER_CONTRACT_SCHEMA_VERSIONS)[keyof typeof WORKER_CONTRACT_SCHEMA_VERSIONS];

export type WorkerFileStatus = "added" | "deleted" | "modified" | "renamed" | "copied" | "unknown";
export type WorkerSeverity = "info" | "low" | "medium" | "high" | "critical";
export type WorkerRiskLevel = "low" | "medium" | "high";
export type WorkerFindingSource = "llm" | "semgrep" | "tree_sitter" | "ci" | "policy";
export type WorkerFindingCategory =
  | "bug"
  | "security"
  | "performance"
  | "maintainability"
  | "testing"
  | "ci"
  | "infrastructure"
  | "documentation";

export interface WorkerReviewJobInput {
  readonly schemaVersion: typeof WORKER_REVIEW_JOB_INPUT_SCHEMA_VERSION;
  readonly deliveryId: string;
  readonly reviewRunId: string;
  readonly repositoryId: string;
  readonly pullRequestId: string;
  readonly pullRequestNumber: number;
  readonly headSha: string;
  readonly triggerEvent: string;
}

export interface WorkerPosition {
  readonly line: number;
  readonly column: number;
}

export interface WorkerLineRange {
  readonly startLine: number;
  readonly endLine: number;
}

export interface WorkerDiffLine {
  readonly type: "context" | "addition" | "deletion";
  readonly content: string;
  readonly oldLineNumber: number | null;
  readonly newLineNumber: number | null;
}

export interface WorkerDiffHunk {
  readonly oldStart: number;
  readonly oldLineCount: number;
  readonly newStart: number;
  readonly newLineCount: number;
  readonly sectionHeader: string;
  readonly lines: WorkerDiffLine[];
}

export interface WorkerChangedFileArtifact {
  readonly path: string;
  readonly previousPath: string | null;
  readonly status: WorkerFileStatus;
  readonly additions: number;
  readonly deletions: number;
  readonly language: string | null;
  readonly patch: string | null;
  readonly headContentSha256: string | null;
  readonly sizeBytes: number | null;
  readonly changedNewLines: number[];
  readonly hunks: WorkerDiffHunk[];
}

export interface WorkerDiffArtifact {
  readonly schemaVersion: typeof WORKER_DIFF_ARTIFACT_SCHEMA_VERSION;
  readonly reviewRunId: string;
  readonly repositoryFullName: string;
  readonly pullRequestNumber: number;
  readonly baseSha: string;
  readonly headSha: string;
  readonly files: WorkerChangedFileArtifact[];
  readonly skippedFiles: WorkerSkippedFileArtifact[];
}

export interface WorkerSkippedFileArtifact {
  readonly path: string;
  readonly previousPath: string | null;
  readonly status: WorkerFileStatus;
  readonly reason: string;
  readonly detail: string;
  readonly excludedFromSemgrep: boolean;
  readonly excludedFromTreeSitter: boolean;
  readonly excludedFromLlmContext: boolean;
}

export interface WorkerSemgrepPosition extends WorkerPosition {
  readonly offset: number | null;
}

export interface WorkerSemgrepFinding {
  readonly id: string;
  readonly ruleId: string;
  readonly path: string;
  readonly start: WorkerSemgrepPosition;
  readonly end: WorkerSemgrepPosition;
  readonly severity: WorkerSeverity;
  readonly sourceSeverity: string;
  readonly message: string;
  readonly fingerprint: string | null;
  readonly lines: string;
  readonly metadata: Record<string, unknown>;
  readonly fix: string | null;
}

export interface WorkerSemgrepError {
  readonly code: string;
  readonly message: string;
  readonly path: string | null;
  readonly severity: "info" | "warning" | "error";
}

export interface WorkerSemgrepSkippedPath {
  readonly path: string;
  readonly reason: string;
  readonly detail: string | null;
}

export interface WorkerSemgrepArtifact {
  readonly schemaVersion: typeof WORKER_SEMGREP_ARTIFACT_SCHEMA_VERSION;
  readonly reviewRunId: string;
  readonly toolVersion: string | null;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly findings: WorkerSemgrepFinding[];
  readonly errors: WorkerSemgrepError[];
  readonly paths: {
    readonly scanned: string[];
    readonly skipped: WorkerSemgrepSkippedPath[];
  };
}

export interface WorkerTreeSitterSymbol {
  readonly name: string;
  readonly kind: string;
  readonly range: WorkerLineRange;
  readonly byteRange: {
    readonly startByte: number;
    readonly endByte: number;
  };
  readonly changed: boolean;
}

export interface WorkerTreeSitterImport {
  readonly source: string;
  readonly symbols: string[];
  readonly line: number;
}

export interface WorkerTreeSitterHunkScope {
  readonly path: string;
  readonly hunkNewStart: number;
  readonly hunkNewEnd: number;
  readonly enclosingSymbol: string | null;
}

export interface WorkerTreeSitterFileArtifact {
  readonly path: string;
  readonly language: string;
  readonly parser: string;
  readonly parseStatus: "parsed" | "partial" | "failed" | "unsupported";
  readonly hasError: boolean;
  readonly missingNodeCount: number;
  readonly errorNodeCount: number;
  readonly symbols: WorkerTreeSitterSymbol[];
  readonly imports: WorkerTreeSitterImport[];
  readonly hunkScopes: WorkerTreeSitterHunkScope[];
  readonly errors: string[];
}

export interface WorkerTreeSitterArtifact {
  readonly schemaVersion: typeof WORKER_TREE_SITTER_ARTIFACT_SCHEMA_VERSION;
  readonly reviewRunId: string;
  readonly parserVersion: string | null;
  readonly files: WorkerTreeSitterFileArtifact[];
}

export type WorkerCiLogUnavailableReason =
  | "checks_unavailable"
  | "github_request_failed"
  | "log_expired"
  | "log_not_found"
  | "missing_actions_permission"
  | "missing_checks_permission"
  | "not_github_actions"
  | "workflow_job_unavailable"
  | "workflow_run_unavailable";

export interface WorkerCiCheckRun {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly conclusion: string;
  readonly appSlug: string | null;
  readonly detailsUrl: string | null;
  readonly htmlUrl: string | null;
  readonly workflowRunId: number | null;
  readonly workflowJobId: number | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

export interface WorkerCiLogEntry {
  readonly checkRunId: number;
  readonly name: string;
  readonly source: "github_actions_job";
  readonly workflowRunId: number | null;
  readonly workflowJobId: number;
  readonly content: string;
  readonly originalBytes: number;
  readonly redactedBytes: number;
  readonly storedBytes: number;
  readonly truncated: boolean;
  readonly redacted: boolean;
}

export interface WorkerUnavailableCiLog {
  readonly checkRunId: number | null;
  readonly name: string | null;
  readonly reason: WorkerCiLogUnavailableReason;
  readonly detail: string;
}

export interface WorkerCiLogArtifact {
  readonly schemaVersion: typeof WORKER_CI_LOG_ARTIFACT_SCHEMA_VERSION;
  readonly reviewRunId: string;
  readonly repositoryFullName: string;
  readonly pullRequestNumber: number;
  readonly headSha: string;
  readonly checkRuns: WorkerCiCheckRun[];
  readonly logs: WorkerCiLogEntry[];
  readonly unavailableLogs: WorkerUnavailableCiLog[];
}

export type WorkerCiFailureCategory =
  | "test_failure"
  | "build_failure"
  | "dependency_failure"
  | "lint_failure"
  | "typecheck_failure"
  | "timeout"
  | "cancellation"
  | "infrastructure"
  | "unknown";

export interface WorkerCiFlakySignal {
  readonly signal: string;
  readonly detail: string;
  readonly confidence: number;
}

export interface WorkerCiFailureEvidence {
  readonly checkRunId: number;
  readonly workflowJobId: number | null;
  readonly stepName: string | null;
  readonly excerpt: string;
}

export interface WorkerCiFailureGroup {
  readonly id: string;
  readonly jobName: string;
  readonly checkRunId: number;
  readonly conclusion: string;
  readonly stepName: string | null;
  readonly category: WorkerCiFailureCategory;
  readonly rootCauseSummary: string;
  readonly suggestedFixes: string[];
  readonly flaky: boolean;
  readonly flakySignals: WorkerCiFlakySignal[];
  readonly evidence: WorkerCiFailureEvidence[];
}

export interface WorkerCiFailureExplanationArtifact {
  readonly schemaVersion: typeof WORKER_CI_FAILURE_EXPLANATION_SCHEMA_VERSION;
  readonly reviewRunId: string;
  readonly repositoryFullName: string;
  readonly pullRequestNumber: number;
  readonly headSha: string;
  readonly summary: string;
  readonly groups: WorkerCiFailureGroup[];
  readonly unavailableLogNotes: WorkerUnavailableCiLog[];
}

export interface WorkerFindingEvidence {
  readonly source: WorkerFindingSource;
  readonly artifactId: string | null;
  readonly path: string | null;
  readonly lineRange: WorkerLineRange | null;
  readonly excerpt: string;
}

export interface WorkerReviewFinding {
  readonly id: string;
  readonly source: WorkerFindingSource;
  readonly category: WorkerFindingCategory;
  readonly severity: WorkerSeverity;
  readonly confidence: number;
  readonly path: string | null;
  readonly lineRange: WorkerLineRange | null;
  readonly title: string;
  readonly body: string;
  readonly evidence: WorkerFindingEvidence[];
  readonly suggestedFix: string | null;
}

export interface WorkerLlmReviewOutput {
  readonly schemaVersion: typeof WORKER_LLM_REVIEW_OUTPUT_SCHEMA_VERSION;
  readonly promptId: string;
  readonly promptVersion: string;
  readonly model: string;
  readonly summary: string;
  readonly riskLevel: WorkerRiskLevel;
  readonly changedComponents: string[];
  readonly inlineFindings: WorkerReviewFinding[];
  readonly summaryFindings: WorkerReviewFinding[];
  readonly testSuggestions: string[];
  readonly ciExplanation: string | null;
  readonly confidence: number;
}

export interface WorkerPublishInlineComment {
  readonly findingId: string;
  readonly path: string;
  readonly line: number;
  readonly body: string;
  readonly severity: WorkerSeverity;
}

export interface WorkerPublishPayload {
  readonly schemaVersion: typeof WORKER_PUBLISH_PAYLOAD_SCHEMA_VERSION;
  readonly reviewRunId: string;
  readonly repositoryFullName: string;
  readonly pullRequestNumber: number;
  readonly headSha: string;
  readonly mode: "dry_run" | "publish";
  readonly summaryBody: string;
  readonly inlineComments: WorkerPublishInlineComment[];
}

const nonEmptyStringSchema = { type: "string", minLength: 1 } as const;
const nullableStringSchema = { anyOf: [nonEmptyStringSchema, { type: "null" }] } as const;
const nonNegativeIntegerSchema = { type: "integer", minimum: 0 } as const;
const positiveIntegerSchema = { type: "integer", minimum: 1 } as const;
const confidenceSchema = { type: "number", minimum: 0, maximum: 1 } as const;
const workerSeveritySchema = { enum: ["info", "low", "medium", "high", "critical"] } as const;
const workerFileStatusSchema = { enum: ["added", "deleted", "modified", "renamed", "copied", "unknown"] } as const;
const workerFindingSourceSchema = { enum: ["llm", "semgrep", "tree_sitter", "ci", "policy"] } as const;
const ciLogUnavailableReasonSchema = {
  enum: [
    "checks_unavailable",
    "github_request_failed",
    "log_expired",
    "log_not_found",
    "missing_actions_permission",
    "missing_checks_permission",
    "not_github_actions",
    "workflow_job_unavailable",
    "workflow_run_unavailable"
  ]
} as const;
const ciFailureCategorySchema = {
  enum: [
    "test_failure",
    "build_failure",
    "dependency_failure",
    "lint_failure",
    "typecheck_failure",
    "timeout",
    "cancellation",
    "infrastructure",
    "unknown"
  ]
} as const;
const workerLineRangeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["startLine", "endLine"],
  properties: {
    startLine: positiveIntegerSchema,
    endLine: positiveIntegerSchema
  }
} as const;

const workerPositionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["line", "column"],
  properties: {
    line: positiveIntegerSchema,
    column: nonNegativeIntegerSchema
  }
} as const;

const semgrepPositionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["line", "column", "offset"],
  properties: {
    line: positiveIntegerSchema,
    column: nonNegativeIntegerSchema,
    offset: { anyOf: [nonNegativeIntegerSchema, { type: "null" }] }
  }
} as const;

const evidenceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["source", "artifactId", "path", "lineRange", "excerpt"],
  properties: {
    source: workerFindingSourceSchema,
    artifactId: nullableStringSchema,
    path: nullableStringSchema,
    lineRange: { anyOf: [workerLineRangeSchema, { type: "null" }] },
    excerpt: nonEmptyStringSchema
  }
} as const;

const reviewFindingSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "source",
    "category",
    "severity",
    "confidence",
    "path",
    "lineRange",
    "title",
    "body",
    "evidence",
    "suggestedFix"
  ],
  properties: {
    id: nonEmptyStringSchema,
    source: workerFindingSourceSchema,
    category: {
      enum: ["bug", "security", "performance", "maintainability", "testing", "ci", "infrastructure", "documentation"]
    },
    severity: workerSeveritySchema,
    confidence: confidenceSchema,
    path: nullableStringSchema,
    lineRange: { anyOf: [workerLineRangeSchema, { type: "null" }] },
    title: nonEmptyStringSchema,
    body: nonEmptyStringSchema,
    evidence: { type: "array", minItems: 1, items: evidenceSchema },
    suggestedFix: nullableStringSchema
  }
} as const;

const unavailableCiLogSchema = {
  type: "object",
  additionalProperties: false,
  required: ["checkRunId", "name", "reason", "detail"],
  properties: {
    checkRunId: { anyOf: [positiveIntegerSchema, { type: "null" }] },
    name: nullableStringSchema,
    reason: ciLogUnavailableReasonSchema,
    detail: nonEmptyStringSchema
  }
} as const;

export const workerReviewJobInputJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://firmcode.dev/schemas/review-job-input.v1.json",
  title: "Firmcode worker review job input v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "deliveryId",
    "reviewRunId",
    "repositoryId",
    "pullRequestId",
    "pullRequestNumber",
    "headSha",
    "triggerEvent"
  ],
  properties: {
    schemaVersion: { const: WORKER_REVIEW_JOB_INPUT_SCHEMA_VERSION },
    deliveryId: nonEmptyStringSchema,
    reviewRunId: nonEmptyStringSchema,
    repositoryId: nonEmptyStringSchema,
    pullRequestId: nonEmptyStringSchema,
    pullRequestNumber: positiveIntegerSchema,
    headSha: nonEmptyStringSchema,
    triggerEvent: nonEmptyStringSchema
  }
} as const;

export const workerDiffArtifactJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://firmcode.dev/schemas/diff-artifact.v1.json",
  title: "Firmcode worker diff artifact v1",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "reviewRunId", "repositoryFullName", "pullRequestNumber", "baseSha", "headSha", "files", "skippedFiles"],
  properties: {
    schemaVersion: { const: WORKER_DIFF_ARTIFACT_SCHEMA_VERSION },
    reviewRunId: nonEmptyStringSchema,
    repositoryFullName: nonEmptyStringSchema,
    pullRequestNumber: positiveIntegerSchema,
    baseSha: nonEmptyStringSchema,
    headSha: nonEmptyStringSchema,
    files: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "path",
          "previousPath",
          "status",
          "additions",
          "deletions",
          "language",
          "patch",
          "headContentSha256",
          "sizeBytes",
          "changedNewLines",
          "hunks"
        ],
        properties: {
          path: nonEmptyStringSchema,
          previousPath: nullableStringSchema,
          status: workerFileStatusSchema,
          additions: nonNegativeIntegerSchema,
          deletions: nonNegativeIntegerSchema,
          language: nullableStringSchema,
          patch: nullableStringSchema,
          headContentSha256: nullableStringSchema,
          sizeBytes: { anyOf: [nonNegativeIntegerSchema, { type: "null" }] },
          changedNewLines: { type: "array", items: positiveIntegerSchema },
          hunks: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["oldStart", "oldLineCount", "newStart", "newLineCount", "sectionHeader", "lines"],
              properties: {
                oldStart: positiveIntegerSchema,
                oldLineCount: nonNegativeIntegerSchema,
                newStart: positiveIntegerSchema,
                newLineCount: nonNegativeIntegerSchema,
                sectionHeader: { type: "string" },
                lines: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["type", "content", "oldLineNumber", "newLineNumber"],
                    properties: {
                      type: { enum: ["context", "addition", "deletion"] },
                      content: { type: "string" },
                      oldLineNumber: { anyOf: [positiveIntegerSchema, { type: "null" }] },
                      newLineNumber: { anyOf: [positiveIntegerSchema, { type: "null" }] }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    skippedFiles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "path",
          "previousPath",
          "status",
          "reason",
          "detail",
          "excludedFromSemgrep",
          "excludedFromTreeSitter",
          "excludedFromLlmContext"
        ],
        properties: {
          path: nonEmptyStringSchema,
          previousPath: nullableStringSchema,
          status: workerFileStatusSchema,
          reason: nonEmptyStringSchema,
          detail: nonEmptyStringSchema,
          excludedFromSemgrep: { type: "boolean" },
          excludedFromTreeSitter: { type: "boolean" },
          excludedFromLlmContext: { type: "boolean" }
        }
      }
    }
  }
} as const;

export const workerSemgrepArtifactJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://firmcode.dev/schemas/semgrep-artifact.v1.json",
  title: "Firmcode worker Semgrep artifact v1",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "reviewRunId", "toolVersion", "exitCode", "durationMs", "findings", "errors", "paths"],
  properties: {
    schemaVersion: { const: WORKER_SEMGREP_ARTIFACT_SCHEMA_VERSION },
    reviewRunId: nonEmptyStringSchema,
    toolVersion: nullableStringSchema,
    exitCode: { type: "integer" },
    durationMs: nonNegativeIntegerSchema,
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "ruleId",
          "path",
          "start",
          "end",
          "severity",
          "sourceSeverity",
          "message",
          "fingerprint",
          "lines",
          "metadata",
          "fix"
        ],
        properties: {
          id: nonEmptyStringSchema,
          ruleId: nonEmptyStringSchema,
          path: nonEmptyStringSchema,
          start: semgrepPositionSchema,
          end: semgrepPositionSchema,
          severity: workerSeveritySchema,
          sourceSeverity: nonEmptyStringSchema,
          message: nonEmptyStringSchema,
          fingerprint: nullableStringSchema,
          lines: { type: "string" },
          metadata: { type: "object", additionalProperties: true },
          fix: nullableStringSchema
        }
      }
    },
    errors: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "message", "path", "severity"],
        properties: {
          code: nonEmptyStringSchema,
          message: nonEmptyStringSchema,
          path: nullableStringSchema,
          severity: { enum: ["info", "warning", "error"] }
        }
      }
    },
    paths: {
      type: "object",
      additionalProperties: false,
      required: ["scanned", "skipped"],
      properties: {
        scanned: { type: "array", items: nonEmptyStringSchema },
        skipped: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["path", "reason", "detail"],
            properties: {
              path: nonEmptyStringSchema,
              reason: nonEmptyStringSchema,
              detail: nullableStringSchema
            }
          }
        }
      }
    }
  }
} as const;

export const workerTreeSitterArtifactJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://firmcode.dev/schemas/tree-sitter-artifact.v1.json",
  title: "Firmcode worker Tree-sitter artifact v1",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "reviewRunId", "parserVersion", "files"],
  properties: {
    schemaVersion: { const: WORKER_TREE_SITTER_ARTIFACT_SCHEMA_VERSION },
    reviewRunId: nonEmptyStringSchema,
    parserVersion: nullableStringSchema,
    files: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "path",
          "language",
          "parser",
          "parseStatus",
          "hasError",
          "missingNodeCount",
          "errorNodeCount",
          "symbols",
          "imports",
          "hunkScopes",
          "errors"
        ],
        properties: {
          path: nonEmptyStringSchema,
          language: nonEmptyStringSchema,
          parser: nonEmptyStringSchema,
          parseStatus: { enum: ["parsed", "partial", "failed", "unsupported"] },
          hasError: { type: "boolean" },
          missingNodeCount: nonNegativeIntegerSchema,
          errorNodeCount: nonNegativeIntegerSchema,
          symbols: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "kind", "range", "byteRange", "changed"],
              properties: {
                name: nonEmptyStringSchema,
                kind: nonEmptyStringSchema,
                range: workerLineRangeSchema,
                byteRange: {
                  type: "object",
                  additionalProperties: false,
                  required: ["startByte", "endByte"],
                  properties: {
                    startByte: nonNegativeIntegerSchema,
                    endByte: nonNegativeIntegerSchema
                  }
                },
                changed: { type: "boolean" }
              }
            }
          },
          imports: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["source", "symbols", "line"],
              properties: {
                source: nonEmptyStringSchema,
                symbols: { type: "array", items: nonEmptyStringSchema },
                line: positiveIntegerSchema
              }
            }
          },
          hunkScopes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["path", "hunkNewStart", "hunkNewEnd", "enclosingSymbol"],
              properties: {
                path: nonEmptyStringSchema,
                hunkNewStart: positiveIntegerSchema,
                hunkNewEnd: positiveIntegerSchema,
                enclosingSymbol: nullableStringSchema
              }
            }
          },
          errors: { type: "array", items: nonEmptyStringSchema }
        }
      }
    }
  }
} as const;

export const workerCiLogArtifactJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://firmcode.dev/schemas/ci-log-artifact.v1.json",
  title: "Firmcode worker CI log artifact v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "reviewRunId",
    "repositoryFullName",
    "pullRequestNumber",
    "headSha",
    "checkRuns",
    "logs",
    "unavailableLogs"
  ],
  properties: {
    schemaVersion: { const: WORKER_CI_LOG_ARTIFACT_SCHEMA_VERSION },
    reviewRunId: nonEmptyStringSchema,
    repositoryFullName: nonEmptyStringSchema,
    pullRequestNumber: positiveIntegerSchema,
    headSha: nonEmptyStringSchema,
    checkRuns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "name",
          "status",
          "conclusion",
          "appSlug",
          "detailsUrl",
          "htmlUrl",
          "workflowRunId",
          "workflowJobId",
          "startedAt",
          "completedAt"
        ],
        properties: {
          id: positiveIntegerSchema,
          name: nonEmptyStringSchema,
          status: nonEmptyStringSchema,
          conclusion: nonEmptyStringSchema,
          appSlug: nullableStringSchema,
          detailsUrl: nullableStringSchema,
          htmlUrl: nullableStringSchema,
          workflowRunId: { anyOf: [positiveIntegerSchema, { type: "null" }] },
          workflowJobId: { anyOf: [positiveIntegerSchema, { type: "null" }] },
          startedAt: nullableStringSchema,
          completedAt: nullableStringSchema
        }
      }
    },
    logs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "checkRunId",
          "name",
          "source",
          "workflowRunId",
          "workflowJobId",
          "content",
          "originalBytes",
          "redactedBytes",
          "storedBytes",
          "truncated",
          "redacted"
        ],
        properties: {
          checkRunId: positiveIntegerSchema,
          name: nonEmptyStringSchema,
          source: { enum: ["github_actions_job"] },
          workflowRunId: { anyOf: [positiveIntegerSchema, { type: "null" }] },
          workflowJobId: positiveIntegerSchema,
          content: { type: "string" },
          originalBytes: nonNegativeIntegerSchema,
          redactedBytes: nonNegativeIntegerSchema,
          storedBytes: nonNegativeIntegerSchema,
          truncated: { type: "boolean" },
          redacted: { type: "boolean" }
        }
      }
    },
    unavailableLogs: {
      type: "array",
      items: unavailableCiLogSchema
    }
  }
} as const;

export const workerCiFailureExplanationJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://firmcode.dev/schemas/ci-failure-explanation.v1.json",
  title: "Firmcode worker CI failure explanation v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "reviewRunId",
    "repositoryFullName",
    "pullRequestNumber",
    "headSha",
    "summary",
    "groups",
    "unavailableLogNotes"
  ],
  properties: {
    schemaVersion: { const: WORKER_CI_FAILURE_EXPLANATION_SCHEMA_VERSION },
    reviewRunId: nonEmptyStringSchema,
    repositoryFullName: nonEmptyStringSchema,
    pullRequestNumber: positiveIntegerSchema,
    headSha: nonEmptyStringSchema,
    summary: nonEmptyStringSchema,
    groups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "jobName",
          "checkRunId",
          "conclusion",
          "stepName",
          "category",
          "rootCauseSummary",
          "suggestedFixes",
          "flaky",
          "flakySignals",
          "evidence"
        ],
        properties: {
          id: nonEmptyStringSchema,
          jobName: nonEmptyStringSchema,
          checkRunId: positiveIntegerSchema,
          conclusion: nonEmptyStringSchema,
          stepName: nullableStringSchema,
          category: ciFailureCategorySchema,
          rootCauseSummary: nonEmptyStringSchema,
          suggestedFixes: { type: "array", minItems: 1, items: nonEmptyStringSchema },
          flaky: { type: "boolean" },
          flakySignals: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["signal", "detail", "confidence"],
              properties: {
                signal: nonEmptyStringSchema,
                detail: nonEmptyStringSchema,
                confidence: confidenceSchema
              }
            }
          },
          evidence: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["checkRunId", "workflowJobId", "stepName", "excerpt"],
              properties: {
                checkRunId: positiveIntegerSchema,
                workflowJobId: { anyOf: [positiveIntegerSchema, { type: "null" }] },
                stepName: nullableStringSchema,
                excerpt: nonEmptyStringSchema
              }
            }
          }
        }
      }
    },
    unavailableLogNotes: { type: "array", items: unavailableCiLogSchema }
  }
} as const;

export const workerLlmReviewOutputJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://firmcode.dev/schemas/llm-review-output.v1.json",
  title: "Firmcode worker LLM review output v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "promptId",
    "promptVersion",
    "model",
    "summary",
    "riskLevel",
    "changedComponents",
    "inlineFindings",
    "summaryFindings",
    "testSuggestions",
    "ciExplanation",
    "confidence"
  ],
  properties: {
    schemaVersion: { const: WORKER_LLM_REVIEW_OUTPUT_SCHEMA_VERSION },
    promptId: nonEmptyStringSchema,
    promptVersion: nonEmptyStringSchema,
    model: nonEmptyStringSchema,
    summary: nonEmptyStringSchema,
    riskLevel: { enum: ["low", "medium", "high"] },
    changedComponents: { type: "array", items: nonEmptyStringSchema },
    inlineFindings: { type: "array", items: reviewFindingSchema },
    summaryFindings: { type: "array", items: reviewFindingSchema },
    testSuggestions: { type: "array", items: nonEmptyStringSchema },
    ciExplanation: nullableStringSchema,
    confidence: confidenceSchema
  }
} as const;

export const workerPublishPayloadJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://firmcode.dev/schemas/publish-payload.v1.json",
  title: "Firmcode worker publish payload v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "reviewRunId",
    "repositoryFullName",
    "pullRequestNumber",
    "headSha",
    "mode",
    "summaryBody",
    "inlineComments"
  ],
  properties: {
    schemaVersion: { const: WORKER_PUBLISH_PAYLOAD_SCHEMA_VERSION },
    reviewRunId: nonEmptyStringSchema,
    repositoryFullName: nonEmptyStringSchema,
    pullRequestNumber: positiveIntegerSchema,
    headSha: nonEmptyStringSchema,
    mode: { enum: ["dry_run", "publish"] },
    summaryBody: nonEmptyStringSchema,
    inlineComments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["findingId", "path", "line", "body", "severity"],
        properties: {
          findingId: nonEmptyStringSchema,
          path: nonEmptyStringSchema,
          line: positiveIntegerSchema,
          body: nonEmptyStringSchema,
          severity: workerSeveritySchema
        }
      }
    }
  }
} as const;

export const workerContractJsonSchemas = {
  reviewJobInput: workerReviewJobInputJsonSchema,
  diffArtifact: workerDiffArtifactJsonSchema,
  semgrepArtifact: workerSemgrepArtifactJsonSchema,
  treeSitterArtifact: workerTreeSitterArtifactJsonSchema,
  ciLogArtifact: workerCiLogArtifactJsonSchema,
  ciFailureExplanation: workerCiFailureExplanationJsonSchema,
  llmReviewOutput: workerLlmReviewOutputJsonSchema,
  publishPayload: workerPublishPayloadJsonSchema
} as const;
