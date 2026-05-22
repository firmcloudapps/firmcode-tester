import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyChangedFileRisk,
  classifyContentRisk,
  classifyPathRisk,
  classifyUnifiedDiffRisk,
  parseUnifiedDiff,
  type ChangedFileRiskFlag
} from "../../src";

const FIXTURE_DIR = join(__dirname, "../fixtures/risk");

function readFixture(name: string): string {
  return readFileSync(join(FIXTURE_DIR, name), "utf8");
}

function flagsForPath(path: string): ChangedFileRiskFlag[] {
  return classifyPathRisk(path).map((reason) => reason.flag);
}

function flagsForContent(content: string): ChangedFileRiskFlag[] {
  return [...new Set(classifyContentRisk(content).map((reason) => reason.flag))];
}

describe("changed-file path risk classification", () => {
  it.each([
    ["apps/api/src/auth/session.ts", "auth"],
    [".env.production", "secrets"],
    ["db/migrations/20260522120000_create_users.sql", "database_migration"],
    ["package-lock.json", "dependency"],
    ["infra/docker/api.Dockerfile", "infrastructure"],
    ["apps/api/src/routes/users.ts", "public_api"],
    [".github/workflows/review.yml", "ci_workflow"]
  ] as const)("flags %s as %s", (path, expectedFlag) => {
    expect(flagsForPath(path)).toContain(expectedFlag);
  });

  it("does not flag ordinary application paths", () => {
    expect(classifyPathRisk("apps/api/src/util/math.ts")).toEqual([]);
  });
});

describe("changed-file content risk classification", () => {
  it.each([
    ['+API_KEY="sk_live_example"', "secrets"],
    ["+const ok = jwt.verify(token, key);", "auth"],
    ["+ALTER TABLE users ADD COLUMN last_login timestamptz;", "database_migration"],
    ['+  "dependencies": {', "dependency"],
    ["+resource \"aws_s3_bucket\" \"logs\" {}", "infrastructure"],
    ["+permissions:", "ci_workflow"],
    ["+export function createUser() {}", "public_api"]
  ] as const)("flags added content %s as %s", (line, expectedFlag) => {
    expect(flagsForContent(line)).toContain(expectedFlag);
  });

  it("ignores deleted and diff metadata lines", () => {
    expect(flagsForContent("--- a/.env\n-API_KEY=old-secret")).toEqual([]);
  });
});

describe("classifyChangedFileRisk", () => {
  it("combines path and content signals into persisted changed-file risk metadata", () => {
    const risk = classifyChangedFileRisk({
      path: "apps/api/src/auth/session.ts",
      patch: "+const token = jwt.verify(sessionToken, publicKey);"
    });

    expect(risk).toMatchObject({
      flags: ["auth"],
      level: "high",
      isInfrastructure: false
    });
    expect(risk.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ flag: "auth", source: "path" }),
        expect.objectContaining({ flag: "auth", source: "content" })
      ])
    );
  });
});

describe("classifyUnifiedDiffRisk", () => {
  it("classifies a mixed application and infrastructure PR fixture for review context", () => {
    const riskByPath = new Map(classifyUnifiedDiffRisk(parseUnifiedDiff(readFixture("mixed-pr.patch"))).map((file) => [
      file.path,
      file.risk.flags
    ]));

    expect(riskByPath.get("apps/api/src/auth/session.ts")).toEqual(["auth"]);
    expect(riskByPath.get("db/migrations/20260522120000_create_audit_log.sql")).toEqual([
      "database_migration"
    ]);
    expect(riskByPath.get("package.json")).toEqual(["dependency"]);
    expect(riskByPath.get("infra/docker/api.Dockerfile")).toEqual(["infrastructure"]);
    expect(riskByPath.get(".github/workflows/review.yml")).toEqual(["ci_workflow"]);
    expect(riskByPath.get("apps/api/src/routes/users.ts")).toEqual(["public_api"]);
    expect(riskByPath.get("apps/api/src/config.ts")).toEqual(["secrets"]);
    expect(riskByPath.get("apps/api/src/util/math.ts")).toEqual([]);
  });
});
