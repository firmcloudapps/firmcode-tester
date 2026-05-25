import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const runbook = readFileSync(resolve(process.cwd(), "../../docs/OPERATIONS_RUNBOOK.md"), "utf8");

const REQUIRED_INCIDENTS = [
  "Codebase Scan Backlog",
  "Codebase Scan GitHub Rate Limit",
  "Codebase Scan Failure",
  "Codebase Scan Semgrep Timeout",
  "Stale Codebase Findings",
  "Codebase Scan Retention Cleanup",
  "Codebase Scan Manual Recovery"
] as const;

describe("codebase scan operations runbook", () => {
  it("documents each scan incident with concrete dashboard steps or commands", () => {
    for (const heading of REQUIRED_INCIDENTS) {
      const section = readSection(heading);

      expect(section, `${heading} section`).toContain("Dashboard:");
      expect(section, `${heading} section`).toMatch(/`[^`]+`/);
    }
  });
});

function readSection(heading: string): string {
  const start = runbook.indexOf(`## ${heading}`);

  expect(start, `${heading} heading`).toBeGreaterThanOrEqual(0);

  const next = runbook.indexOf("\n## ", start + heading.length + 4);

  return next === -1 ? runbook.slice(start) : runbook.slice(start, next);
}
