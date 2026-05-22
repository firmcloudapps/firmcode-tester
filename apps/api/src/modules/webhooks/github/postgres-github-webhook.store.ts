import { randomUUID } from "crypto";
import type { ReviewRunStatus } from "@firmcode/shared";
import type { DatabaseExecutor } from "../../../infrastructure/database/migrations";
import type {
  GitHubDeliveryInput,
  GitHubDeliveryRecord,
  GitHubDeliveryStatus,
  GitHubInstallationRecord,
  GitHubInstallationUpsert,
  PullRequestRecord,
  PullRequestUpsert,
  RepositoryRecord,
  RepositoryUpsert,
  ReviewJobInput,
  ReviewJobRecord,
  ReviewRunInput,
  ReviewRunPublishCheck,
  ReviewRunPublishCheckInput,
  ReviewRunRecord,
  ReviewRunStatusUpdate,
  SupersedeReviewRunsInput
} from "./github-webhook.store";

type JsonObject = Record<string, unknown>;

interface GitHubDeliveryRow {
  readonly delivery_id: string;
  readonly event_name: string;
  readonly action: string | null;
  readonly installation_id: string | number | null;
  readonly repository_id: string | number | null;
  readonly pull_request_number: number | null;
  readonly head_sha: string | null;
  readonly status: GitHubDeliveryStatus;
  readonly received_at: Date;
  readonly processed_at: Date | null;
  readonly error: string | null;
}

interface GitHubInstallationRow {
  readonly id: string;
  readonly installation_id: string | number;
  readonly account_login: string | null;
  readonly account_type: string | null;
  readonly permissions_json: JsonObject;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface RepositoryRow {
  readonly id: string;
  readonly installation_id: string;
  readonly github_repository_id: string | number;
  readonly owner: string;
  readonly name: string;
  readonly full_name: string;
  readonly private: boolean;
  readonly default_branch: string;
  readonly enabled: boolean;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface PullRequestRow {
  readonly id: string;
  readonly repository_id: string;
  readonly github_pr_id: string | number;
  readonly number: number;
  readonly title: string;
  readonly author_login: string;
  readonly base_ref: string;
  readonly head_ref: string;
  readonly base_sha: string;
  readonly head_sha: string;
  readonly state: string;
  readonly draft: boolean;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface ReviewRunRow {
  readonly id: string;
  readonly repository_id: string;
  readonly pull_request_id: string;
  readonly delivery_id: string;
  readonly trigger_event: string;
  readonly status: ReviewRunStatus;
  readonly head_sha: string;
  readonly started_at: Date | null;
  readonly finished_at: Date | null;
  readonly error_code: string | null;
  readonly error_message: string | null;
  readonly metrics_json: JsonObject;
  readonly created_at: Date;
}

const FINISHED_REVIEW_RUN_STATUSES = new Set<ReviewRunStatus>(["succeeded", "failed", "superseded"]);

export class PostgresGitHubWebhookStore {
  constructor(
    private readonly database: DatabaseExecutor,
    private readonly createId: () => string = randomUUID
  ) {}

  async createDelivery(input: GitHubDeliveryInput): Promise<{ created: boolean; delivery: GitHubDeliveryRecord }> {
    const inserted = await this.database.query<GitHubDeliveryRow>(
      `
INSERT INTO github_deliveries (
  delivery_id,
  event_name,
  action,
  installation_id,
  repository_id,
  pull_request_number,
  head_sha
) VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (delivery_id) DO NOTHING
RETURNING *
`,
      [
        input.deliveryId,
        input.eventName,
        input.action,
        input.installationId,
        input.repositoryId,
        input.pullRequestNumber,
        input.headSha
      ]
    );

    if (inserted.rows[0] !== undefined) {
      return { created: true, delivery: toGitHubDeliveryRecord(inserted.rows[0]) };
    }

    const existing = await this.database.query<GitHubDeliveryRow>(
      "SELECT * FROM github_deliveries WHERE delivery_id = $1",
      [input.deliveryId]
    );

    return { created: false, delivery: toGitHubDeliveryRecord(requireRow(existing.rows[0], "github delivery")) };
  }

  async markDeliveryProcessed(
    deliveryId: string,
    status: Exclude<GitHubDeliveryStatus, "processing">,
    error?: string
  ): Promise<void> {
    await this.database.query(
      `
UPDATE github_deliveries
SET status = $2,
    processed_at = now(),
    error = $3
WHERE delivery_id = $1
`,
      [deliveryId, status, error ?? null]
    );
  }

  async upsertInstallation(input: GitHubInstallationUpsert): Promise<GitHubInstallationRecord> {
    const result = await this.database.query<GitHubInstallationRow>(
      `
INSERT INTO github_installations (
  id,
  installation_id,
  account_login,
  account_type,
  permissions_json
) VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (installation_id) DO UPDATE
SET account_login = EXCLUDED.account_login,
    account_type = EXCLUDED.account_type,
    permissions_json = EXCLUDED.permissions_json,
    updated_at = now()
RETURNING *
`,
      [this.createId(), input.installationId, input.accountLogin, input.accountType, input.permissionsJson]
    );

    return toGitHubInstallationRecord(requireRow(result.rows[0], "github installation"));
  }

  async upsertRepository(input: RepositoryUpsert): Promise<RepositoryRecord> {
    const result = await this.database.query<RepositoryRow>(
      `
INSERT INTO repositories (
  id,
  installation_id,
  github_repository_id,
  owner,
  name,
  full_name,
  private,
  default_branch,
  enabled
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (github_repository_id) DO UPDATE
SET installation_id = EXCLUDED.installation_id,
    owner = EXCLUDED.owner,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    private = EXCLUDED.private,
    default_branch = EXCLUDED.default_branch,
    enabled = EXCLUDED.enabled,
    updated_at = now()
RETURNING *
`,
      [
        this.createId(),
        input.installationId,
        input.githubRepositoryId,
        input.owner,
        input.name,
        input.fullName,
        input.private,
        input.defaultBranch,
        input.enabled
      ]
    );

    return toRepositoryRecord(requireRow(result.rows[0], "repository"));
  }

  async upsertPullRequest(input: PullRequestUpsert): Promise<PullRequestRecord> {
    const result = await this.database.query<PullRequestRow>(
      `
INSERT INTO pull_requests (
  id,
  repository_id,
  github_pr_id,
  number,
  title,
  author_login,
  base_ref,
  head_ref,
  base_sha,
  head_sha,
  state,
  draft
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (repository_id, number) DO UPDATE
SET github_pr_id = EXCLUDED.github_pr_id,
    title = EXCLUDED.title,
    author_login = EXCLUDED.author_login,
    base_ref = EXCLUDED.base_ref,
    head_ref = EXCLUDED.head_ref,
    base_sha = EXCLUDED.base_sha,
    head_sha = EXCLUDED.head_sha,
    state = EXCLUDED.state,
    draft = EXCLUDED.draft,
    updated_at = now()
RETURNING *
`,
      [
        this.createId(),
        input.repositoryId,
        input.githubPullRequestId,
        input.number,
        input.title,
        input.authorLogin,
        input.baseRef,
        input.headRef,
        input.baseSha,
        input.headSha,
        input.state,
        input.draft
      ]
    );

    return toPullRequestRecord(requireRow(result.rows[0], "pull request"));
  }

  async createReviewRun(input: ReviewRunInput): Promise<ReviewRunRecord> {
    const result = await this.database.query<ReviewRunRow>(
      `
INSERT INTO review_runs (
  id,
  repository_id,
  pull_request_id,
  delivery_id,
  trigger_event,
  head_sha
) VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *
`,
      [this.createId(), input.repositoryId, input.pullRequestId, input.deliveryId, input.triggerEvent, input.headSha]
    );

    return toReviewRunRecord(requireRow(result.rows[0], "review run"));
  }

  async findReviewRun(reviewRunId: string): Promise<ReviewRunRecord | null> {
    const result = await this.database.query<ReviewRunRow>("SELECT * FROM review_runs WHERE id = $1", [reviewRunId]);
    return result.rows[0] === undefined ? null : toReviewRunRecord(result.rows[0]);
  }

  async updateReviewRunStatus(input: ReviewRunStatusUpdate): Promise<ReviewRunRecord | null> {
    const existing = await this.findReviewRun(input.reviewRunId);

    if (existing === null) {
      return null;
    }

    const startedAt = input.status === "running" ? existing.startedAt ?? new Date() : existing.startedAt;
    const finishedAt = FINISHED_REVIEW_RUN_STATUSES.has(input.status) ? existing.finishedAt ?? new Date() : existing.finishedAt;
    const errorCode = input.errorCode === undefined ? existing.errorCode : input.errorCode;
    const errorMessage = input.errorMessage === undefined ? existing.errorMessage : input.errorMessage;

    const result = await this.database.query<ReviewRunRow>(
      `
UPDATE review_runs
SET status = $2,
    started_at = $3,
    finished_at = $4,
    error_code = $5,
    error_message = $6,
    updated_at = now()
WHERE id = $1
RETURNING *
`,
      [input.reviewRunId, input.status, startedAt, finishedAt, errorCode, errorMessage]
    );

    return result.rows[0] === undefined ? null : toReviewRunRecord(result.rows[0]);
  }

  async supersedeQueuedOrRunningReviewRuns(input: SupersedeReviewRunsInput): Promise<ReviewRunRecord[]> {
    const result = await this.database.query<ReviewRunRow>(
      `
UPDATE review_runs
SET status = 'superseded',
    finished_at = COALESCE(finished_at, now()),
    error_code = 'superseded_by_new_head',
    error_message = $3,
    updated_at = now()
WHERE pull_request_id = $1
  AND head_sha <> $2
  AND status IN ('queued', 'running')
RETURNING *
`,
      [
        input.pullRequestId,
        input.headSha,
        `Superseded by delivery ${input.supersededByDeliveryId} for head ${input.headSha}`
      ]
    );

    return result.rows.map(toReviewRunRecord);
  }

  async verifyReviewRunHeadBeforePublishing(input: ReviewRunPublishCheckInput): Promise<ReviewRunPublishCheck> {
    const reviewRun = await this.findReviewRun(input.reviewRunId);

    if (reviewRun === null) {
      return {
        publishable: false,
        reason: "review_run_not_found",
        reviewRun: null,
        currentHeadSha: input.currentHeadSha
      };
    }

    if (reviewRun.status === "superseded") {
      return {
        publishable: false,
        reason: "review_run_superseded",
        reviewRun,
        currentHeadSha: input.currentHeadSha
      };
    }

    if (reviewRun.headSha !== input.currentHeadSha) {
      const supersededRun = await this.updateReviewRunStatus({
        reviewRunId: reviewRun.id,
        status: "superseded",
        errorCode: "current_head_sha_changed",
        errorMessage: `Skipped publishing because current PR head is ${input.currentHeadSha}`
      });

      return {
        publishable: false,
        reason: "head_sha_changed",
        reviewRun: supersededRun,
        currentHeadSha: input.currentHeadSha
      };
    }

    return {
      publishable: true,
      reason: null,
      reviewRun,
      currentHeadSha: input.currentHeadSha
    };
  }

  enqueuePullRequestReview(input: ReviewJobInput): ReviewJobRecord {
    return {
      id: input.deliveryId,
      name: "review.pull_request",
      ...input,
      createdAt: new Date()
    };
  }
}

function requireRow<Row>(row: Row | undefined, label: string): Row {
  if (row === undefined) {
    throw new Error(`Expected ${label} row`);
  }

  return row;
}

function toGitHubDeliveryRecord(row: GitHubDeliveryRow): GitHubDeliveryRecord {
  return {
    deliveryId: row.delivery_id,
    eventName: row.event_name,
    action: row.action,
    installationId: toNullableNumber(row.installation_id),
    repositoryId: toNullableNumber(row.repository_id),
    pullRequestNumber: row.pull_request_number,
    headSha: row.head_sha,
    status: row.status,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
    error: row.error
  };
}

function toGitHubInstallationRecord(row: GitHubInstallationRow): GitHubInstallationRecord {
  return {
    id: row.id,
    installationId: Number(row.installation_id),
    accountLogin: row.account_login,
    accountType: row.account_type,
    permissionsJson: row.permissions_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toRepositoryRecord(row: RepositoryRow): RepositoryRecord {
  return {
    id: row.id,
    installationId: row.installation_id,
    githubRepositoryId: Number(row.github_repository_id),
    owner: row.owner,
    name: row.name,
    fullName: row.full_name,
    private: row.private,
    defaultBranch: row.default_branch,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toPullRequestRecord(row: PullRequestRow): PullRequestRecord {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    githubPullRequestId: Number(row.github_pr_id),
    number: row.number,
    title: row.title,
    authorLogin: row.author_login,
    baseRef: row.base_ref,
    headRef: row.head_ref,
    baseSha: row.base_sha,
    headSha: row.head_sha,
    state: row.state,
    draft: row.draft,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toReviewRunRecord(row: ReviewRunRow): ReviewRunRecord {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    pullRequestId: row.pull_request_id,
    deliveryId: row.delivery_id,
    triggerEvent: row.trigger_event,
    status: row.status,
    headSha: row.head_sha,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    metricsJson: row.metrics_json,
    createdAt: row.created_at
  };
}

function toNullableNumber(value: string | number | null): number | null {
  return value === null ? null : Number(value);
}
