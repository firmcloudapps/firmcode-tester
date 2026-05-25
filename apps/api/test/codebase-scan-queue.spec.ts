import {
  codebaseScanJobId,
  codebaseScanSchedulerId,
  InMemoryCodebaseScanQueueProducer
} from "../src/modules/queues/codebase-scan-queue";
import type { CodebaseScanJobInput } from "../src/modules/queues/codebase-scan-queue";

describe("codebase scan queue producer", () => {
  it("deduplicates active scan jobs by repository and commit SHA when known", async () => {
    const queue = new InMemoryCodebaseScanQueueProducer();
    const input = scanJob({ commitSha: "abc123", trigger: "push" });

    const first = await queue.enqueueCodebaseScan(input);
    const second = await queue.enqueueCodebaseScan({
      ...input,
      scanRunId: "scan-2",
      correlationId: "correlation-2"
    });

    expect(first.id).toBe("codebase-scan:repo-1:abc123");
    expect(second).toBe(first);
    expect(queue.jobs).toHaveLength(1);
  });

  it("deduplicates active scan jobs by repository and trigger when commit SHA is unknown", async () => {
    const queue = new InMemoryCodebaseScanQueueProducer();
    const input = scanJob({ commitSha: null, trigger: "manual" });

    await queue.enqueueCodebaseScan(input);
    await queue.enqueueCodebaseScan({ ...input, scanRunId: "scan-2" });

    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs.has("codebase-scan:repo-1:manual")).toBe(true);
  });

  it("upserts repeatable schedules by repository using the configured cadence", async () => {
    const queue = new InMemoryCodebaseScanQueueProducer();
    const input = scanJob({ commitSha: null, trigger: "scheduled", scanRunId: null });

    const first = await queue.scheduleCodebaseScan(input, 24);
    const second = await queue.scheduleCodebaseScan({ ...input, correlationId: "correlation-2" }, 12);

    expect(first.schedulerId).toBe(codebaseScanSchedulerId("repo-1"));
    expect(second).toEqual({
      schedulerId: codebaseScanSchedulerId("repo-1"),
      jobId: codebaseScanJobId({ repositoryId: "repo-1", commitSha: null, trigger: "scheduled" }),
      cadenceHours: 12
    });
    expect(queue.schedules).toHaveLength(1);
    expect(queue.schedules.get(codebaseScanSchedulerId("repo-1"))).toMatchObject({
      cadenceHours: 12,
      input: {
        scanRunId: null,
        commitSha: null,
        trigger: "scheduled"
      }
    });
  });
});

function scanJob(overrides: Partial<CodebaseScanJobInput> = {}): CodebaseScanJobInput {
  return {
    schemaVersion: "codebase-scan-job-input/v1",
    scanRunId: "scan-1",
    repositoryId: "repo-1",
    installationId: 101,
    repositoryFullName: "openclaw/firmcode",
    defaultBranch: "main",
    commitSha: null,
    trigger: "manual",
    correlationId: "correlation-1",
    requestedByClerkUserId: "user-1",
    ...overrides
  };
}
