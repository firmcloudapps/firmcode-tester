import type { ReviewRunStatus } from "../enums/review-run-status";
import type { ChangedFileRiskClassification } from "../risk/changed-file-risk";

export interface ReviewRunSummary {
  id: string;
  repositoryFullName: string;
  pullRequestNumber: number;
  headSha: string;
  status: ReviewRunStatus;
  findingsCount: number;
  createdAt: string;
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
