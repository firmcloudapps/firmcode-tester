import type { ReviewRunStatus } from "../enums/review-run-status";

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
