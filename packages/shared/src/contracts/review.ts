import type { ReviewRunStatus } from "../enums/review-run-status";
import type { ChangedFileRiskClassification } from "../risk/changed-file-risk";
import type { LargePullRequestReviewArtifact, ReviewSkippedFileReport } from "../review/large-pr-handling";

export interface ReviewRunSummary {
  id: string;
  repositoryFullName: string;
  pullRequestNumber: number;
  headSha: string;
  status: ReviewRunStatus;
  findingsCount: number;
  createdAt: string;
}

export interface ReviewRunPublishedComment {
  id: string;
  commentType: "summary" | "inline" | "review";
  findingId: string | null;
  githubCommentId: number | null;
  githubReviewId: number | null;
  filePath: string | null;
  line: number | null;
  body: string | null;
  bodyHash: string;
  dryRun: boolean;
  createdAt: string;
}

export interface ReviewRunDetail extends ReviewRunSummary {
  repositoryId: string;
  pullRequestId: string;
  triggerEvent: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metrics: Record<string, unknown>;
  publishedComments: ReviewRunPublishedComment[];
}

export const DEFAULT_REVIEW_LIMITS = {
  maxInlineComments: 10,
  artifactRetentionDays: 30
} as const;

export interface ReviewContextPack {
  schemaVersion: "review-context/v1";
  reviewRunId: string;
  repositoryFullName: string;
  pullRequestNumber: number;
  headSha: string;
  files: ReviewContextFile[];
  largePullRequest?: LargePullRequestReviewArtifact;
  skippedFiles?: ReviewSkippedFileReport[];
}

export interface ReviewContextFile {
  path: string;
  previousPath: string | null;
  status: string;
  additions: number;
  deletions: number;
  language: string | null;
  risk: ChangedFileRiskClassification;
}
