export const REVIEW_RUN_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "superseded"
] as const;

export type ReviewRunStatus = (typeof REVIEW_RUN_STATUSES)[number];
