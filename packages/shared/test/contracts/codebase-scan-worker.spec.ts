import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import {
  WORKER_CONTRACT_SCHEMA_VERSIONS,
  workerCodebaseScanArtifactMetadataJsonSchema,
  workerCodebaseScanFindingJsonSchema,
  workerCodebaseScanJobInputJsonSchema,
  workerCodebaseScanReviewEnrichmentJsonSchema
} from "../../src";

const FIXTURE_DIR = join(__dirname, "../fixtures/worker-contracts");

const scanFixtures = [
  ["codebaseScanJobInput", "codebase-scan-job-input.v1.json", workerCodebaseScanJobInputJsonSchema],
  [
    "codebaseScanArtifactMetadata",
    "codebase-scan-artifact-metadata.v1.json",
    workerCodebaseScanArtifactMetadataJsonSchema
  ],
  ["codebaseScanFinding", "codebase-scan-finding.v1.json", workerCodebaseScanFindingJsonSchema],
  [
    "codebaseScanReviewEnrichment",
    "codebase-scan-review-enrichment.v1.json",
    workerCodebaseScanReviewEnrichmentJsonSchema
  ]
] as const;

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8"));
}

function ajv(): Ajv2020 {
  return new Ajv2020({ allErrors: true, strict: true });
}

describe("codebase scan worker contracts", () => {
  it.each(scanFixtures)("validates the %s compatibility fixture", (_schemaName, fixtureName, schema) => {
    const validate = ajv().compile(schema);
    const fixture = readFixture(fixtureName);

    expect(validate(fixture), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("pins scan contract fixtures to v1 schema versions", () => {
    const actualVersions = scanFixtures.map(([schemaName, fixtureName]) => [
      schemaName,
      (readFixture(fixtureName) as { schemaVersion: string }).schemaVersion
    ]);

    expect(actualVersions).toEqual([
      ["codebaseScanJobInput", WORKER_CONTRACT_SCHEMA_VERSIONS.codebaseScanJobInput],
      ["codebaseScanArtifactMetadata", WORKER_CONTRACT_SCHEMA_VERSIONS.codebaseScanArtifactMetadata],
      ["codebaseScanFinding", WORKER_CONTRACT_SCHEMA_VERSIONS.codebaseScanFinding],
      ["codebaseScanReviewEnrichment", WORKER_CONTRACT_SCHEMA_VERSIONS.codebaseScanReviewEnrichment]
    ]);
  });

  it("rejects unredacted evidence omissions in normalized scan findings", () => {
    const validate = ajv().compile(workerCodebaseScanFindingJsonSchema);
    const fixture = readFixture("codebase-scan-finding.v1.json") as Record<string, unknown>;
    const evidence = [{ ...((fixture.evidence as Record<string, unknown>[])[0] ?? {}), redacted: null }];
    const invalid = {
      ...fixture,
      evidence
    };

    expect(validate(invalid)).toBe(false);
    expect(validate.errors?.map((error) => error.instancePath)).toContain("/evidence/0/redacted");
  });
});
