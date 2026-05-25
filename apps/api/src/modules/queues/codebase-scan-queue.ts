import { type OnModuleDestroy } from "@nestjs/common";
import { Queue, type JobsOptions } from "bullmq";
import type { WorkerCodebaseScanJobInput } from "@firmcode/shared";

export const CODEBASE_SCAN_QUEUE = Symbol("CODEBASE_SCAN_QUEUE");
export const CODEBASE_SCAN_QUEUE_NAME = "codebase-scans";
export const CODEBASE_SCAN_JOB_NAME = "codebase.scan";

export type CodebaseScanJobInput = WorkerCodebaseScanJobInput;

export interface CodebaseScanJobRecord extends CodebaseScanJobInput {
  id: string;
  name: typeof CODEBASE_SCAN_JOB_NAME;
  attempts: number;
  createdAt: Date;
}

export interface CodebaseScanScheduleRecord {
  readonly schedulerId: string;
  readonly jobId: string;
  readonly cadenceHours: number;
}

export interface CodebaseScanQueueProducer {
  enqueueCodebaseScan(input: CodebaseScanJobInput): Promise<CodebaseScanJobRecord>;
  scheduleCodebaseScan(input: CodebaseScanJobInput, cadenceHours: number): Promise<CodebaseScanScheduleRecord>;
  removeCodebaseScanSchedule(repositoryId: string): Promise<boolean>;
}

export const CODEBASE_SCAN_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000
  },
  removeOnComplete: false,
  removeOnFail: false
};

export function codebaseScanJobId(input: Pick<CodebaseScanJobInput, "repositoryId" | "commitSha" | "trigger">): string {
  return `codebase-scan:${input.repositoryId}:${input.commitSha ?? input.trigger}`;
}

export function codebaseScanSchedulerId(repositoryId: string): string {
  return `codebase-scan:${repositoryId}:scheduled`;
}

export class InMemoryCodebaseScanQueueProducer implements CodebaseScanQueueProducer {
  readonly jobs = new Map<string, CodebaseScanJobRecord>();
  readonly schedules = new Map<string, CodebaseScanScheduleRecord & { input: CodebaseScanJobInput }>();

  async enqueueCodebaseScan(input: CodebaseScanJobInput): Promise<CodebaseScanJobRecord> {
    const id = codebaseScanJobId(input);
    const existing = this.jobs.get(id);

    if (existing !== undefined) {
      return existing;
    }

    const job: CodebaseScanJobRecord = {
      id,
      name: CODEBASE_SCAN_JOB_NAME,
      attempts: CODEBASE_SCAN_JOB_OPTIONS.attempts ?? 1,
      ...input,
      createdAt: new Date()
    };
    this.jobs.set(id, job);

    return job;
  }

  async scheduleCodebaseScan(input: CodebaseScanJobInput, cadenceHours: number): Promise<CodebaseScanScheduleRecord> {
    const schedulerId = codebaseScanSchedulerId(input.repositoryId);
    const jobId = codebaseScanJobId({ ...input, trigger: "scheduled", commitSha: null });
    const schedule = {
      schedulerId,
      jobId,
      cadenceHours,
      input: {
        ...input,
        scanRunId: null,
        commitSha: null,
        trigger: "scheduled" as const
      }
    };

    this.schedules.set(schedulerId, schedule);

    return {
      schedulerId,
      jobId,
      cadenceHours
    };
  }

  async removeCodebaseScanSchedule(repositoryId: string): Promise<boolean> {
    return this.schedules.delete(codebaseScanSchedulerId(repositoryId));
  }
}

export class BullMqCodebaseScanQueueProducer implements CodebaseScanQueueProducer, OnModuleDestroy {
  private readonly queue: Queue<CodebaseScanJobInput>;

  constructor(redisUrl: string) {
    this.queue = new Queue<CodebaseScanJobInput>(CODEBASE_SCAN_QUEUE_NAME, {
      connection: {
        url: redisUrl
      },
      defaultJobOptions: CODEBASE_SCAN_JOB_OPTIONS
    });
  }

  async enqueueCodebaseScan(input: CodebaseScanJobInput): Promise<CodebaseScanJobRecord> {
    const id = codebaseScanJobId(input);
    const job = await this.queue.add(CODEBASE_SCAN_JOB_NAME, input, {
      ...CODEBASE_SCAN_JOB_OPTIONS,
      jobId: id
    });

    return {
      id: job.id ?? id,
      name: CODEBASE_SCAN_JOB_NAME,
      attempts: CODEBASE_SCAN_JOB_OPTIONS.attempts ?? 1,
      ...input,
      createdAt: new Date(job.timestamp)
    };
  }

  async scheduleCodebaseScan(input: CodebaseScanJobInput, cadenceHours: number): Promise<CodebaseScanScheduleRecord> {
    const scheduledInput: CodebaseScanJobInput = {
      ...input,
      scanRunId: null,
      commitSha: null,
      trigger: "scheduled"
    };
    const schedulerId = codebaseScanSchedulerId(input.repositoryId);
    const job = await this.queue.upsertJobScheduler(
      schedulerId,
      {
        every: cadenceHours * 60 * 60 * 1000
      },
      {
        name: CODEBASE_SCAN_JOB_NAME,
        data: scheduledInput,
        opts: {
          ...CODEBASE_SCAN_JOB_OPTIONS
        }
      }
    );

    return {
      schedulerId,
      jobId: job.id ?? codebaseScanJobId(scheduledInput),
      cadenceHours
    };
  }

  async removeCodebaseScanSchedule(repositoryId: string): Promise<boolean> {
    return this.queue.removeJobScheduler(codebaseScanSchedulerId(repositoryId));
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
