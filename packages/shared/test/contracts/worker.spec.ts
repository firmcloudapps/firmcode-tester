import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import {
  WORKER_CONTRACT_SCHEMA_VERSIONS,
  workerContractJsonSchemas,
  workerReviewJobInputJsonSchema
} from "../../src";

const FIXTURE_DIR = join(__dirname, "../fixtures/worker-contracts");

const fixtures = [
  ["reviewJobInput", "review-job-input.v1.json"],
  ["diffArtifact", "diff-artifact.v1.json"],
  ["semgrepArtifact", "semgrep-artifact.v1.json"],
  ["treeSitterArtifact", "tree-sitter-artifact.v1.json"],
  ["llmReviewOutput", "llm-review-output.v1.json"],
  ["publishPayload", "publish-payload.v1.json"]
] as const;

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8"));
}

function ajv(): Ajv2020 {
  return new Ajv2020({ allErrors: true, strict: true });
}

describe("worker contract JSON schemas", () => {
  it.each(fixtures)("validates the %s compatibility fixture", (schemaName, fixtureName) => {
    const validate = ajv().compile(workerContractJsonSchemas[schemaName]);
    const fixture = readFixture(fixtureName);

    expect(validate(fixture), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("rejects invalid worker payloads with useful field paths", () => {
    const validate = ajv().compile(workerReviewJobInputJsonSchema);
    const valid = readFixture("review-job-input.v1.json") as Record<string, unknown>;
    const invalid = {
      ...valid,
      schemaVersion: "review-job-input/v0",
      pullRequestNumber: 0,
      headSha: ""
    };

    expect(validate(invalid)).toBe(false);
    expect(validate.errors?.map((error) => error.instancePath)).toEqual(
      expect.arrayContaining(["/schemaVersion", "/pullRequestNumber", "/headSha"])
    );
  });

  it("keeps all current worker contract fixtures pinned to v1 schema versions", () => {
    const actualVersions = fixtures.map(([schemaName, fixtureName]) => [
      schemaName,
      (readFixture(fixtureName) as { schemaVersion: string }).schemaVersion
    ]);

    expect(actualVersions).toEqual([
      ["reviewJobInput", WORKER_CONTRACT_SCHEMA_VERSIONS.reviewJobInput],
      ["diffArtifact", WORKER_CONTRACT_SCHEMA_VERSIONS.diffArtifact],
      ["semgrepArtifact", WORKER_CONTRACT_SCHEMA_VERSIONS.semgrepArtifact],
      ["treeSitterArtifact", WORKER_CONTRACT_SCHEMA_VERSIONS.treeSitterArtifact],
      ["llmReviewOutput", WORKER_CONTRACT_SCHEMA_VERSIONS.llmReviewOutput],
      ["publishPayload", WORKER_CONTRACT_SCHEMA_VERSIONS.publishPayload]
    ]);
  });
});
