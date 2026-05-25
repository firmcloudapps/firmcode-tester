import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import { PostgresCodebaseScanStore } from "../src/modules/codebase-scans/codebase-scan.store";

interface PgPoolLike {
  query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
}

const REPOSITORY_ID = "00000000-0000-4000-8000-000000000002";
const FIRST_SCAN_RUN_ID = "00000000-0000-4000-8000-000000000101";
const SECOND_SCAN_RUN_ID = "00000000-0000-4000-8000-000000000102";
const FIRST_FINDING_ID = "00000000-0000-4000-8000-000000000201";
const SECOND_FINDING_ID = "00000000-0000-4000-8000-000000000202";

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

function createIdFactory(ids: readonly string[]): () => string {
  let index = 0;

  return () => {
    const id = ids[index];
    index += 1;

    if (id === undefined) {
      throw new Error("No deterministic ID was configured for this test.");
    }

    return id;
  };
}

describe("PostgresCodebaseScanStore", () => {
  let pool: PgPoolLike;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    await seedRepository(pool);
  });

  afterEach(async () => {
    await pool.end();
  });

  it("creates and updates repository-linked scan runs without pull request or delivery rows", async () => {
    const store = new PostgresCodebaseScanStore(pool, createIdFactory([FIRST_SCAN_RUN_ID]));

    const scanRun = await store.createScanRun({
      repositoryId: REPOSITORY_ID,
      trigger: "manual",
      defaultBranch: "main",
      commitSha: "abc123",
      metrics: { plannedFileCount: 2 }
    });
    const updated = await store.updateScanRun({
      scanRunId: scanRun.id,
      status: "succeeded",
      startedAt: "2026-05-25T10:00:00.000Z",
      finishedAt: "2026-05-25T10:01:00.000Z",
      metrics: { scannedFileCount: 2, findingCount: 1 },
      artifacts: [
        {
          artifactType: "semgrep",
          storageKey: "artifacts/codebase-scans/scan-1/semgrep.json",
          sizeBytes: 512,
          sha256: "digest",
          redacted: true,
          retentionExpiresAt: "2026-06-24T10:00:00.000Z",
          metadata: { secretLikeValuesRedacted: 1 }
        }
      ]
    });

    expect(scanRun).toMatchObject({
      id: FIRST_SCAN_RUN_ID,
      repositoryId: REPOSITORY_ID,
      trigger: "manual",
      status: "queued",
      metrics: { plannedFileCount: 2 }
    });
    expect(updated).toMatchObject({
      id: FIRST_SCAN_RUN_ID,
      status: "succeeded",
      metrics: { scannedFileCount: 2, findingCount: 1 },
      artifacts: [
        {
          artifactType: "semgrep",
          redacted: true
        }
      ]
    });

    const pullRequests = await pool.query("SELECT id FROM pull_requests");
    const deliveries = await pool.query("SELECT delivery_id FROM github_deliveries");

    expect(pullRequests.rows).toEqual([]);
    expect(deliveries.rows).toEqual([]);
  });

  it("reuses active scan runs for unknown commits by repository and trigger", async () => {
    const store = new PostgresCodebaseScanStore(pool, createIdFactory([FIRST_SCAN_RUN_ID, SECOND_SCAN_RUN_ID]));

    const first = await store.createOrReuseActiveScanRun({
      repositoryId: REPOSITORY_ID,
      trigger: "manual",
      defaultBranch: "main",
      commitSha: null
    });
    const duplicate = await store.createOrReuseActiveScanRun({
      repositoryId: REPOSITORY_ID,
      trigger: "manual",
      defaultBranch: "main",
      commitSha: null
    });
    await store.updateScanRun({ scanRunId: first.scanRun.id, status: "failed" });
    const fresh = await store.createOrReuseActiveScanRun({
      repositoryId: REPOSITORY_ID,
      trigger: "manual",
      defaultBranch: "main",
      commitSha: null
    });

    expect(first).toMatchObject({
      created: true,
      scanRun: {
        id: FIRST_SCAN_RUN_ID,
        commitSha: null,
        status: "queued"
      }
    });
    expect(duplicate).toMatchObject({
      created: false,
      scanRun: {
        id: FIRST_SCAN_RUN_ID
      }
    });
    expect(fresh).toMatchObject({
      created: true,
      scanRun: {
        id: SECOND_SCAN_RUN_ID
      }
    });
  });

  it("reuses active scan runs for known commits across triggers", async () => {
    const store = new PostgresCodebaseScanStore(pool, createIdFactory([FIRST_SCAN_RUN_ID]));

    const first = await store.createOrReuseActiveScanRun({
      repositoryId: REPOSITORY_ID,
      trigger: "push",
      defaultBranch: "main",
      commitSha: "abc123"
    });
    const duplicate = await store.createOrReuseActiveScanRun({
      repositoryId: REPOSITORY_ID,
      trigger: "manual",
      defaultBranch: "main",
      commitSha: "abc123"
    });

    expect(first.created).toBe(true);
    expect(duplicate).toMatchObject({
      created: false,
      scanRun: {
        id: FIRST_SCAN_RUN_ID,
        commitSha: "abc123"
      }
    });
  });

  it("upserts findings by repository dedupe key and keeps the original first seen timestamp", async () => {
    const store = new PostgresCodebaseScanStore(
      pool,
      createIdFactory([FIRST_SCAN_RUN_ID, FIRST_FINDING_ID, SECOND_SCAN_RUN_ID, SECOND_FINDING_ID])
    );
    const firstRun = await store.createScanRun({
      repositoryId: REPOSITORY_ID,
      trigger: "scheduled",
      defaultBranch: "main",
      commitSha: "abc123"
    });
    const firstFinding = await store.upsertFinding({
      scanRunId: firstRun.id,
      repositoryId: REPOSITORY_ID,
      source: "semgrep",
      category: "security",
      severity: "high",
      confidence: "high",
      filePath: "src/server.ts",
      startLine: 42,
      endLine: 42,
      title: "Avoid shell execution",
      body: "A scanner found request-controlled data reaching shell execution.",
      evidence: [scanEvidence("src/server.ts", 42)],
      recommendation: "Use an allowlisted command wrapper.",
      dedupeKey: "semgrep:dangerous-exec:src/server.ts:42"
    });
    const secondRun = await store.createScanRun({
      repositoryId: REPOSITORY_ID,
      trigger: "push",
      defaultBranch: "main",
      commitSha: "def456"
    });
    const secondFinding = await store.upsertFinding({
      scanRunId: secondRun.id,
      repositoryId: REPOSITORY_ID,
      source: "semgrep",
      category: "security",
      severity: "critical",
      confidence: "high",
      filePath: "src/server.ts",
      startLine: 42,
      endLine: 42,
      title: "Avoid shell execution",
      body: "The finding is still present after the latest scan.",
      evidence: [scanEvidence("src/server.ts", 42)],
      recommendation: "Replace shell execution with a safe API.",
      dedupeKey: "semgrep:dangerous-exec:src/server.ts:42"
    });

    expect(secondFinding.id).toBe(firstFinding.id);
    expect(secondFinding.scanRunId).toBe(secondRun.id);
    expect(secondFinding.severity).toBe("critical");
    expect(secondFinding.firstSeenAt).toBe(firstFinding.firstSeenAt);

    const rows = await pool.query("SELECT id FROM codebase_scan_findings");
    expect(rows.rows).toHaveLength(1);
  });

  it("queries open findings and resolves stale findings after a successful scan", async () => {
    const store = new PostgresCodebaseScanStore(
      pool,
      createIdFactory([FIRST_SCAN_RUN_ID, FIRST_FINDING_ID, SECOND_FINDING_ID])
    );
    const scanRun = await store.createScanRun({
      repositoryId: REPOSITORY_ID,
      trigger: "scheduled",
      defaultBranch: "main",
      commitSha: "abc123"
    });

    await store.upsertFinding({
      scanRunId: scanRun.id,
      repositoryId: REPOSITORY_ID,
      source: "semgrep",
      category: "security",
      severity: "high",
      confidence: "high",
      filePath: "src/server.ts",
      startLine: 42,
      endLine: 42,
      title: "Avoid shell execution",
      body: "A scanner found request-controlled data reaching shell execution.",
      evidence: [scanEvidence("src/server.ts", 42)],
      recommendation: "Use an allowlisted command wrapper.",
      dedupeKey: "semgrep:dangerous-exec:src/server.ts:42"
    });
    await store.upsertFinding({
      scanRunId: scanRun.id,
      repositoryId: REPOSITORY_ID,
      source: "policy",
      category: "maintainability",
      severity: "medium",
      confidence: "medium",
      filePath: "src/legacy.ts",
      startLine: 10,
      endLine: 12,
      title: "Legacy module has no owner",
      body: "Repository policy requires an owner for this module.",
      evidence: [scanEvidence("src/legacy.ts", 10)],
      recommendation: "Add the module to CODEOWNERS.",
      dedupeKey: "policy:missing-owner:src/legacy.ts"
    });

    const openServerFindings = await store.listOpenFindings({
      repositoryId: REPOSITORY_ID,
      severities: ["high", "critical"],
      filePaths: ["src/server.ts"]
    });
    await store.updateScanRun({ scanRunId: scanRun.id, status: "failed" });
    const failedResolutionCount = await store.resolveStaleFindingsAfterSuccessfulScan({
      scanRunId: scanRun.id,
      repositoryId: REPOSITORY_ID,
      observedDedupeKeys: ["semgrep:dangerous-exec:src/server.ts:42"]
    });
    await store.updateScanRun({ scanRunId: scanRun.id, status: "succeeded" });
    const resolvedCount = await store.resolveStaleFindingsAfterSuccessfulScan({
      scanRunId: scanRun.id,
      repositoryId: REPOSITORY_ID,
      observedDedupeKeys: ["semgrep:dangerous-exec:src/server.ts:42"]
    });
    const remainingOpen = await store.listOpenFindings({ repositoryId: REPOSITORY_ID });

    expect(openServerFindings.map((finding) => finding.dedupeKey)).toEqual(["semgrep:dangerous-exec:src/server.ts:42"]);
    expect(failedResolutionCount).toBe(0);
    expect(resolvedCount).toBe(1);
    expect(remainingOpen.map((finding) => finding.dedupeKey)).toEqual(["semgrep:dangerous-exec:src/server.ts:42"]);
  });

  it("loads review enrichment findings for changed files and high severity touched components only", async () => {
    const store = new PostgresCodebaseScanStore(
      pool,
      createIdFactory([
        FIRST_SCAN_RUN_ID,
        FIRST_FINDING_ID,
        SECOND_FINDING_ID,
        "00000000-0000-4000-8000-000000000203",
        "00000000-0000-4000-8000-000000000204"
      ])
    );
    const scanRun = await store.createScanRun({
      repositoryId: REPOSITORY_ID,
      trigger: "scheduled",
      defaultBranch: "main",
      commitSha: "abc123"
    });

    await store.upsertFinding({
      scanRunId: scanRun.id,
      repositoryId: REPOSITORY_ID,
      source: "semgrep",
      category: "security",
      severity: "medium",
      confidence: "high",
      filePath: "src/server.ts",
      startLine: 12,
      endLine: 12,
      title: "Direct changed file issue",
      body: "The exact changed file has an unresolved issue.",
      evidence: [scanEvidence("src/server.ts", 12)],
      recommendation: "Fix the changed file issue.",
      dedupeKey: "direct-medium"
    });
    await store.upsertFinding({
      scanRunId: scanRun.id,
      repositoryId: REPOSITORY_ID,
      source: "semgrep",
      category: "security",
      severity: "high",
      confidence: "high",
      filePath: "src/auth/token.ts",
      startLine: 8,
      endLine: 8,
      title: "Component issue",
      body: "A touched component has an unresolved high severity issue.",
      evidence: [scanEvidence("src/auth/token.ts", 8)],
      recommendation: "Fix the component issue.",
      dedupeKey: "component-high"
    });
    await store.upsertFinding({
      scanRunId: scanRun.id,
      repositoryId: REPOSITORY_ID,
      source: "policy",
      category: "maintainability",
      severity: "medium",
      confidence: "medium",
      filePath: "src/auth/owner.ts",
      startLine: 5,
      endLine: 5,
      title: "Medium component issue",
      body: "Medium component findings should not enrich unless directly changed.",
      evidence: [scanEvidence("src/auth/owner.ts", 5)],
      recommendation: "Assign an owner.",
      dedupeKey: "component-medium"
    });
    await store.upsertFinding({
      scanRunId: scanRun.id,
      repositoryId: REPOSITORY_ID,
      source: "semgrep",
      category: "security",
      severity: "critical",
      confidence: "high",
      filePath: "packages/shared/src/token.ts",
      startLine: 30,
      endLine: 30,
      title: "Unrelated issue",
      body: "Unrelated components should not enrich the PR.",
      evidence: [scanEvidence("packages/shared/src/token.ts", 30)],
      recommendation: "Fix unrelated issue.",
      dedupeKey: "unrelated-critical"
    });

    const findings = await store.listReviewEnrichmentFindings({
      repositoryId: REPOSITORY_ID,
      changedFilePaths: ["src/server.ts"],
      componentPrefixes: ["src/auth"],
      limit: 10
    });

    expect(findings.map((finding) => finding.dedupeKey)).toEqual(["component-high", "direct-medium"]);
  });
});

function scanEvidence(path: string, line: number) {
  return {
    source: "semgrep" as const,
    artifactType: "semgrep" as const,
    path,
    lineRange: {
      startLine: line,
      endLine: line
    },
    excerpt: "redacted evidence",
    redacted: true
  };
}

async function seedRepository(pool: PgPoolLike): Promise<void> {
  await pool.query(
    `
INSERT INTO github_installations (
  id,
  installation_id,
  permissions_json
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  101,
  '{"contents":"read"}'
);

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
) VALUES (
  '${REPOSITORY_ID}',
  '00000000-0000-4000-8000-000000000001',
  202,
  'openclaw',
  'firmcode',
  'openclaw/firmcode',
  false,
  'main',
  true
);
`
  );
}
