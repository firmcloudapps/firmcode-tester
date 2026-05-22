import { type OnModuleDestroy } from "@nestjs/common";
import { Queue, type JobsOptions } from "bullmq";
import type { WorkerReviewJobInput } from "@firmcode/shared";

export const REVIEW_QUEUE = Symbol("REVIEW_QUEUE");
export const REVIEW_QUEUE_NAME = "review-runs";
export const REVIEW_PULL_REQUEST_JOB_NAME = "review.pull_request";

export type ReviewJobInput = WorkerReviewJobInput;

export interface ReviewJobRecord extends ReviewJobInput {
  id: string;
  name: typeof REVIEW_PULL_REQUEST_JOB_NAME;
  attempts: number;
  createdAt: Date;
}

export interface ReviewQueueProducer {
  enqueuePullRequestReview(input: ReviewJobInput): Promise<ReviewJobRecord>;
}

export const REVIEW_PULL_REQUEST_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000
  },
  removeOnComplete: false,
  removeOnFail: false
};

export class InMemoryReviewQueueProducer implements ReviewQueueProducer {
  readonly jobs = new Map<string, ReviewJobRecord>();

  async enqueuePullRequestReview(input: ReviewJobInput): Promise<ReviewJobRecord> {
    const existing = this.jobs.get(input.deliveryId);

    if (existing !== undefined) {
      return existing;
    }

    const job: ReviewJobRecord = {
      id: input.deliveryId,
      name: REVIEW_PULL_REQUEST_JOB_NAME,
      attempts: REVIEW_PULL_REQUEST_JOB_OPTIONS.attempts ?? 1,
      ...input,
      createdAt: new Date()
    };
    this.jobs.set(input.deliveryId, job);

    return job;
  }
}

export class BullMqReviewQueueProducer implements ReviewQueueProducer, OnModuleDestroy {
  private readonly queue: Queue<ReviewJobInput>;

  constructor(redisUrl: string) {
    this.queue = new Queue<ReviewJobInput>(REVIEW_QUEUE_NAME, {
      connection: {
        url: redisUrl
      },
      defaultJobOptions: REVIEW_PULL_REQUEST_JOB_OPTIONS
    });
  }

  async enqueuePullRequestReview(input: ReviewJobInput): Promise<ReviewJobRecord> {
    const job = await this.queue.add(REVIEW_PULL_REQUEST_JOB_NAME, input, {
      ...REVIEW_PULL_REQUEST_JOB_OPTIONS,
      jobId: input.deliveryId
    });

    return {
      id: job.id ?? input.deliveryId,
      name: REVIEW_PULL_REQUEST_JOB_NAME,
      attempts: REVIEW_PULL_REQUEST_JOB_OPTIONS.attempts ?? 1,
      ...input,
      createdAt: new Date(job.timestamp)
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
